import { z } from "zod";
import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateJoinCode } from "@/lib/pools";
import { deriveEscrowPDA, callInitializePool } from "@/lib/solana";
import { publishPoolUpdate } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const wallet = url.searchParams.get("wallet");

    let memberPools: { pool_id: string; team_id: string; team_name: string; team_flag_url: string | null; team_group: string | null; score: number; rank: number | null }[] | null = null;
    if (wallet) {
      const { data } = await supabaseAdmin
        .from("pool_members")
        .select("pool_id, team_id, team_name, team_flag_url, team_group, score, rank")
        .eq("wallet", wallet);
      memberPools = data;
    }

    let query = supabaseAdmin.from("pools").select("*");
    const walletPoolIds = memberPools?.map((m) => m.pool_id);
    if (walletPoolIds && walletPoolIds.length > 0) {
      query = query.in("id", walletPoolIds);
    } else if (wallet && (!walletPoolIds || walletPoolIds.length === 0)) {
      return Response.json({ pools: [] });
    }

    const { data: pools, error } = await query
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      logger.error("Failed to list pools", { error, wallet });
      throw new ApiError(500, "POOLS_LIST_FAILED", "Failed to list pools");
    }

    // Only show pools that aren't in a terminal failure state unless the user created them
    const visiblePools = (pools ?? []).filter(
      (p) => p.status !== "onchain_failed" || p.created_by === wallet,
    );

    const poolIdsToCount = visiblePools.map((p) => p.id);
    const { data: allMembers } = poolIdsToCount.length > 0
      ? await supabaseAdmin
          .from("pool_members")
          .select("pool_id, wallet, team_id, team_name, team_flag_url, team_group, score, rank")
          .in("pool_id", poolIdsToCount)
      : { data: [] };

    const countMap = new Map<string, number>();
    const memberByPoolId = new Map<string, typeof allMembers>();
    if (allMembers) {
      for (const m of allMembers) {
        countMap.set(m.pool_id, (countMap.get(m.pool_id) ?? 0) + 1);
        if (wallet && m.wallet === wallet) {
          memberByPoolId.set(m.pool_id, [m]);
        }
      }
    }

    return Response.json({
      pools: visiblePools.map((pool) => {
        const myMember = memberByPoolId.get(pool.id)?.[0];
        return {
          id: pool.id,
          name: pool.name,
          createdBy: pool.created_by,
          joinCode: pool.join_code,
          status: pool.status,
          entryFeeUsdc: Number(pool.entry_fee_usdc),
          totalStakedUsdc: Number(pool.total_staked_usdc),
          maxMembers: pool.max_members,
          memberCount: countMap.get(pool.id) ?? 0,
          escrowPda: pool.escrow_pda,
          createdAt: pool.created_at,
          winnerWallet: pool.winner_wallet,
          settlementTx: pool.settlement_tx,
          isPrivate: pool.is_private,
          ...(myMember ? {
            myTeam: {
              teamId: myMember.team_id,
              teamName: myMember.team_name,
              teamFlagUrl: myMember.team_flag_url,
              teamGroup: myMember.team_group,
              score: myMember.score,
              rank: myMember.rank,
            },
          } : {}),
        };
      }),
    });
  } catch (e) {
    return handleRouteError(e);
  }
}

const bodySchema = z.object({
  name: z.string().min(3).max(60),
  entryFeeUsdc: z.number().min(0),
  maxMembers: z.number().int().min(2).max(32).default(32),
  isPrivate: z.boolean().default(false),
  passphrase: z.string().min(1).max(100).optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const { wallet } = await requireAuth(request);
    await withRateLimit(request, 5, "1m", wallet);

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return handleRouteError(parsed.error);
    }

    const { name, entryFeeUsdc, maxMembers, isPrivate, passphrase } = parsed.data;

    if (entryFeeUsdc > 0 && entryFeeUsdc < 0.0001) {
      throw new ApiError(400, "INVALID_FEE", "Entry fee must be 0 or at least 0.0001 SOL");
    }

    const joinCode = await generateJoinCode();
    const poolId = crypto.randomUUID();

    let escrowPda: string | null = null;
    if (entryFeeUsdc > 0) {
      const [pda] = deriveEscrowPDA(poolId);
      escrowPda = pda.toString();
    }

    const { data: pool, error } = await supabaseAdmin
      .from("pools")
      .insert({
        id: poolId,
        name,
        created_by: wallet,
        join_code: joinCode,
        entry_fee_usdc: entryFeeUsdc,
        max_members: maxMembers,
        escrow_pda: escrowPda,
        status: "waiting",
        is_private: isPrivate,
        passphrase: isPrivate ? (passphrase ?? null) : null,
      })
      .select()
      .single();

    if (error || !pool) {
      logger.error("Failed to create pool", { error, wallet });
      throw new ApiError(500, "POOL_CREATE_FAILED", "Failed to create pool");
    }

    // Initialize on-chain pool (free pool — 0 fee on-chain, fee tracked in DB only)
    // Required even for "free" pools so the PoolState PDA exists for joinPool.
    await callInitializePool(poolId, entryFeeUsdc, maxMembers).catch((e) => {
      logger.error("Pool init on-chain failed (non-fatal)", { poolId, error: String(e) });
    });

    await publishPoolUpdate(pool.id, {
      type: "heartbeat",
      poolId: pool.id,
      timestamp: Date.now(),
      data: { action: "created", wallet },
    });

    logger.info("Pool created", { poolId: pool.id, wallet, joinCode });

    return Response.json({
      pool: {
        id: pool.id,
        name: pool.name,
        joinCode: pool.join_code,
        status: pool.status,
        entryFeeUsdc: Number(pool.entry_fee_usdc),
        maxMembers: pool.max_members,
        escrowPda: pool.escrow_pda,
        createdAt: pool.created_at,
        isPrivate: pool.is_private,
        passphrase: pool.passphrase,
      },
      joinUrl: `${env.NEXT_PUBLIC_APP_URL}/join/${joinCode}`,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
