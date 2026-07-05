import { z } from "zod";
import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { assignTeam, computeLeaderboard } from "@/lib/pools";
import { verifyJoinPoolTx } from "@/lib/solana";
import { getAllTeams } from "@/lib/txline";
import { redis, publishPoolUpdate } from "@/lib/redis";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  displayName: z.string().min(1).max(40),
  stakeTxSignature: z.string().optional(),
  tempToken: z.string().optional(),
});

const DUPLICATE_JOIN_CODE = "23505"; // unique_violation

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

    const { displayName, stakeTxSignature, tempToken } = parsed.data;

    const { data: pool, error: poolError } = await supabaseAdmin
      .from("pools")
      .select("*")
      .eq("join_code", joinCode)
      .single();

    if (poolError || !pool) {
      throw new ApiError(404, "POOL_NOT_FOUND", "Pool not found");
    }

    if (pool.status === "settled" || pool.status === "onchain_failed") {
      throw new ApiError(409, "POOL_SETTLED", "This pool has already been settled or failed");
    }

    // Check pool capacity (best-effort — race window exists but is extremely narrow)
    const { count: memberCount } = await supabaseAdmin
      .from("pool_members")
      .select("*", { count: "exact", head: true })
      .eq("pool_id", pool.id);

    if (memberCount != null && memberCount >= pool.max_members) {
      throw new ApiError(409, "POOL_FULL", "This pool is full");
    }

    // Check duplicate join (unique constraint on pool_id+wallet catches any race)
    const { data: existingMember } = await supabaseAdmin
      .from("pool_members")
      .select("id")
      .eq("pool_id", pool.id)
      .eq("wallet", wallet)
      .single();

    if (existingMember) {
      throw new ApiError(409, "ALREADY_JOINED", "You have already joined this pool");
    }

    // Resolve team ID from temp token or assign a new team
    let assignedTeam: Awaited<ReturnType<typeof assignTeam>> | null = null;
    let resolvedTeamId: string | null = null;

    if (tempToken) {
      const raw = await redis.get(`join:temp:${tempToken}`);
      if (!raw) {
        throw new ApiError(400, "TEMP_TOKEN_EXPIRED", "Team assignment expired. Please try again.");
      }
      const pending = JSON.parse(raw as string);
      if (pending.wallet !== wallet || pending.poolId !== pool.id) {
        throw new ApiError(400, "TEMP_TOKEN_INVALID", "Invalid team assignment token.");
      }
      resolvedTeamId = pending.teamId;
      await redis.del(`join:temp:${tempToken}`);
    }

    // Verify on-chain transaction for paid pools
    if (Number(pool.entry_fee_usdc) > 0) {
      if (!stakeTxSignature) {
        throw new ApiError(
          400,
          "STAKE_REQUIRED",
          "Stake transaction signature required for paid pools",
        );
      }

      const validJoinTx = await verifyJoinPoolTx(
        stakeTxSignature,
        pool.id,
        wallet,
      );

      if (!validJoinTx) {
        throw new ApiError(
          402,
          "JOIN_TX_VERIFICATION_FAILED",
          "Could not verify join pool transaction on-chain",
        );
      }
    }

    if (resolvedTeamId) {
      const allTeams = await getAllTeams();
      const found = allTeams.find((t) => t.id === resolvedTeamId);
      if (found) {
        assignedTeam = found;
      }
    }
    if (!assignedTeam) {
      assignedTeam = await assignTeam(pool.id);
    }

    // Insert the member — unique constraint on (pool_id, wallet) catches race doubles
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

    if (insertError) {
      if (insertError.code === DUPLICATE_JOIN_CODE) {
        throw new ApiError(409, "ALREADY_JOINED", "You have already joined this pool");
      }
      logger.error("Failed to insert pool member", { error: insertError, wallet, poolId: pool.id });
      throw new ApiError(500, "JOIN_FAILED", "Failed to join pool");
    }

    // Update pool status outside the critical path - no need to rollback if these fail
    if (pool.status === "waiting") {
      await supabaseAdmin
        .from("pools")
        .update({ status: "active" })
        .eq("id", pool.id)
        .maybeSingle();
    }

    if (Number(pool.entry_fee_usdc) > 0) {
      await supabaseAdmin
        .from("pools")
        .update({
          total_staked_usdc: Number(pool.total_staked_usdc) + Number(pool.entry_fee_usdc),
        })
        .eq("id", pool.id)
        .maybeSingle();
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
