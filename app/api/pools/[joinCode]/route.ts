import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase";
import { computeLeaderboard } from "@/lib/pools";
import { cacheGet, cacheSet } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ joinCode: string }> },
) {
  try {
    await withRateLimit(request, 60, "1m");

    const { joinCode } = await params;
    const cacheKey = `pool:detail:${joinCode}`;

    const cached = await cacheGet(cacheKey, z.any());
    if (cached) {
      return Response.json(cached);
    }

    const { data: pool, error } = await supabaseAdmin
      .from("pools")
      .select("*")
      .eq("join_code", joinCode)
      .single();

    if (error || !pool) {
      throw new ApiError(404, "POOL_NOT_FOUND", "Pool not found");
    }

    const leaderboard = await computeLeaderboard(pool.id);

    const { count: memberCount } = await supabaseAdmin
      .from("pool_members")
      .select("*", { count: "exact", head: true })
      .eq("pool_id", pool.id);

    const response = {
      pool: {
        id: pool.id,
        name: pool.name,
        createdBy: pool.created_by,
        joinCode: pool.join_code,
        status: pool.status,
        entryFeeUsdc: Number(pool.entry_fee_usdc),
        totalStakedUsdc: Number(pool.total_staked_usdc),
        escrowPda: pool.escrow_pda,
        winnerWallet: pool.winner_wallet,
        settlementTx: pool.settlement_tx,
        maxMembers: pool.max_members,
        createdAt: pool.created_at,
        settledAt: pool.settled_at,
      },
      leaderboard,
      memberCount: memberCount ?? 0,
      spotsRemaining: pool.max_members - (memberCount ?? 0),
      joinUrl: `${env.NEXT_PUBLIC_APP_URL}/join/${joinCode}`,
    };

    await cacheSet(cacheKey, response, 10);

    return Response.json(response);
  } catch (e) {
    return handleRouteError(e);
  }
}
