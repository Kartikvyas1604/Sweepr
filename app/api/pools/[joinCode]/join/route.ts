import { z } from "zod";
import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { assignTeam, computeLeaderboard } from "@/lib/pools";
import { verifyUsdcTransfer } from "@/lib/solana";
import { publishPoolUpdate } from "@/lib/redis";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  displayName: z.string().min(1).max(40),
  stakeTxSignature: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ joinCode: string }> },
) {
  try {
    const { wallet } = await requireAuth(request);
    await withRateLimit(request, 10, "1m", wallet);

    const { joinCode } = await params;

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return handleRouteError(parsed.error);
    }

    const { displayName, stakeTxSignature } = parsed.data;

    const { data: pool, error: poolError } = await supabaseAdmin
      .from("pools")
      .select("*")
      .eq("join_code", joinCode)
      .single();

    if (poolError || !pool) {
      throw new ApiError(404, "POOL_NOT_FOUND", "Pool not found");
    }

    if (pool.status === "settled") {
      throw new ApiError(409, "POOL_SETTLED", "This pool has already been settled");
    }

    const { count: memberCount } = await supabaseAdmin
      .from("pool_members")
      .select("*", { count: "exact", head: true })
      .eq("pool_id", pool.id);

    if (memberCount != null && memberCount >= pool.max_members) {
      throw new ApiError(409, "POOL_FULL", "This pool is full");
    }

    const { data: existingMember } = await supabaseAdmin
      .from("pool_members")
      .select("id")
      .eq("pool_id", pool.id)
      .eq("wallet", wallet)
      .single();

    if (existingMember) {
      throw new ApiError(409, "ALREADY_JOINED", "You have already joined this pool");
    }

    if (Number(pool.entry_fee_usdc) > 0) {
      if (!stakeTxSignature) {
        throw new ApiError(
          400,
          "STAKE_REQUIRED",
          "Stake transaction signature required for paid pools",
        );
      }

      const valid = await verifyUsdcTransfer(
        stakeTxSignature,
        wallet,
        pool.escrow_pda ?? "",
        Number(pool.entry_fee_usdc),
      );

      if (!valid) {
        throw new ApiError(
          402,
          "PAYMENT_VERIFICATION_FAILED",
          "Could not verify USDC transfer to escrow",
        );
      }
    }

    const assignedTeam = await assignTeam(pool.id);

    const { data: member, error: insertError } = await supabaseAdmin
      .from("pool_members")
      .insert({
        pool_id: pool.id,
        wallet,
        display_name: displayName,
        team_id: assignedTeam.id,
        team_name: assignedTeam.name,
        team_flag_url: assignedTeam.flagUrl,
        team_group: assignedTeam.group,
        stake_tx: stakeTxSignature ?? null,
      })
      .select()
      .single();

    if (insertError || !member) {
      logger.error("Failed to join pool", { error: insertError, wallet, poolId: pool.id });
      throw new ApiError(500, "JOIN_FAILED", "Failed to join pool");
    }

    if (pool.status === "waiting") {
      await supabaseAdmin
        .from("pools")
        .update({ status: "active" })
        .eq("id", pool.id);
    }

    if (Number(pool.entry_fee_usdc) > 0) {
      await supabaseAdmin
        .from("pools")
        .update({
          total_staked_usdc: Number(pool.total_staked_usdc) + Number(pool.entry_fee_usdc),
        })
        .eq("id", pool.id);
    }

    await publishPoolUpdate(pool.id, {
      type: "member_joined",
      poolId: pool.id,
      timestamp: Date.now(),
      data: {
        wallet,
        displayName,
        teamName: assignedTeam.name,
        teamFlagUrl: assignedTeam.flagUrl,
      },
    });

    const leaderboard = await computeLeaderboard(pool.id);

    logger.info("Member joined pool", {
      wallet,
      poolId: pool.id,
      teamId: assignedTeam.id,
    });

    return Response.json({
      member: {
        id: member.id,
        wallet: member.wallet,
        displayName: member.display_name,
        teamId: member.team_id,
        teamName: member.team_name,
        teamFlagUrl: member.team_flag_url,
        score: member.score,
        joinedAt: member.joined_at,
      },
      assignedTeam,
      leaderboard,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
