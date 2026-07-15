import { z } from "zod";
import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { computeLeaderboard, getPoolAvailableTeams } from "@/lib/pools";
import { verifyJoinPoolTx, verifySolTransfer, derivePoolPDA } from "@/lib/solana";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { redis, publishPoolUpdate } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { sanitizeDisplayName } from "@/lib/utils";
import { verifyPassphrase } from "@/lib/security";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  displayName: z.string().min(1).max(40),
  teamId: z.string(),
  stakeTxSignature: z.string().optional(),
  passphrase: z.string().optional(),
});

const DUPLICATE_JOIN_CODE = "23505";

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

    const displayName = sanitizeDisplayName(parsed.data.displayName);
    const { stakeTxSignature, teamId } = parsed.data;

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

    if (pool.is_private && !verifyPassphrase(parsed.data.passphrase, pool.passphrase)) {
      throw new ApiError(403, "INVALID_PASSPHRASE", "Incorrect pool passphrase");
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

    const poolScope = pool.scope || "all";
    const poolTeams = await getPoolAvailableTeams(pool.id, poolScope);
    const validTeam = poolTeams.find((t) => t.teamId === teamId);

    if (!validTeam) {
      throw new ApiError(400, "INVALID_TEAM", "That team is not available in this pool");
    }

    const existingTeam = await supabaseAdmin
      .from("pool_members")
      .select("id, display_name")
      .eq("pool_id", pool.id)
      .eq("team_id", teamId)
      .maybeSingle();

    if (existingTeam.data) {
      throw new ApiError(
        409,
        "TEAM_TAKEN",
        `${validTeam.teamName} was just claimed by ${existingTeam.data.display_name}. Please choose another team.`,
      );
    }

    if (Number(pool.entry_fee_usdc) > 0) {
      if (!stakeTxSignature) {
        throw new ApiError(
          400,
          "STAKE_REQUIRED",
          "Stake transaction signature required for paid pools",
        );
      }

      const entryFeeSol = Number(pool.entry_fee_usdc);
      const validJoinTx = await verifyJoinPoolTx(
        stakeTxSignature,
        pool.id,
        wallet,
        entryFeeSol,
      );

      if (!validJoinTx) {
        throw new ApiError(
          402,
          "JOIN_TX_VERIFICATION_FAILED",
          "Could not verify join pool transaction on-chain",
        );
      }

      const [poolPda] = derivePoolPDA(pool.id);
      const solVerified = await verifySolTransfer(
        stakeTxSignature,
        wallet,
        poolPda.toBase58(),
        Math.round(entryFeeSol * Number(LAMPORTS_PER_SOL)),
      );

      if (!solVerified) {
        throw new ApiError(
          402,
          "SOL_TRANSFER_VERIFICATION_FAILED",
          "Could not verify SOL transfer on-chain",
        );
      }
    }

    const { data: member, error: insertError } = await supabaseAdmin
      .from("pool_members")
      .insert({
        pool_id: pool.id,
        wallet,
        display_name: displayName,
        team_id: validTeam.teamId,
        team_name: validTeam.teamName,
        team_flag_url: validTeam.flagUrl,
        team_group: validTeam.group,
        team_chosen_at: new Date().toISOString(),
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
        teamName: validTeam.teamName,
        teamFlagUrl: validTeam.flagUrl,
        teamId,
      },
    });

    const leaderboard = await computeLeaderboard(pool.id);

    logger.info("Member joined pool with chosen team", {
      wallet,
      poolId: pool.id,
      teamId,
      teamName: validTeam.teamName,
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
      leaderboard,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
