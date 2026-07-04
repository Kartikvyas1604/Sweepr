import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { assignTeam } from "@/lib/pools";
import { teamIdToBytes } from "@/lib/solana";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ joinCode: string }> },
) {
  try {
    const { wallet } = await requireAuth(request);
    await withRateLimit(request, 10, "1m", wallet);

    const { joinCode } = await params;

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

    const assignedTeam = await assignTeam(pool.id);

    const tempToken = crypto.randomUUID();
    await redis.set(
      `join:temp:${tempToken}`,
      JSON.stringify({
        poolId: pool.id,
        wallet,
        joinCode,
        teamId: assignedTeam.id,
        teamName: assignedTeam.name,
        teamFlagUrl: assignedTeam.flagUrl,
        group: assignedTeam.group,
        displayName: null,
      }),
      { ex: 600 },
    );

    logger.info("Team assigned (pending join)", {
      wallet,
      poolId: pool.id,
      teamId: assignedTeam.id,
      tempToken,
    });

    return Response.json({
      tempToken,
      team: {
        id: assignedTeam.id,
        name: assignedTeam.name,
        shortName: assignedTeam.shortName,
        flagUrl: assignedTeam.flagUrl,
        group: assignedTeam.group,
      },
      teamIdBytes: teamIdToBytes(assignedTeam.id),
      entryFeeUsdc: Number(pool.entry_fee_usdc),
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
