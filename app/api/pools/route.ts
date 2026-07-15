import { z } from "zod";
import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateJoinCode, getPoolAvailableTeams } from "@/lib/pools";
import { deriveEscrowPDA, callInitializePool } from "@/lib/solana";
import { publishPoolUpdate } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sanitizePoolName } from "@/lib/utils";
import { getFixtureById, getAllTeams } from "@/lib/txline";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await withRateLimit(request, 30, "1m");
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
          scope: pool.scope || "all",
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
  scope: z.enum(["all", "single", "custom"]).default("all"),
  fixtureIds: z.array(z.string()).optional(),
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

    const { name: rawName, entryFeeUsdc, maxMembers, isPrivate, passphrase, scope, fixtureIds } = parsed.data;
    const name = sanitizePoolName(rawName);

    if (entryFeeUsdc > 0 && entryFeeUsdc < 0.0001) {
      throw new ApiError(400, "INVALID_FEE", "Entry fee must be 0 or at least 0.0001 SOL");
    }

    let finalMaxMembers = maxMembers;
    let poolFixturesToInsert: { fixture_id: string; home_team_id: string; home_team_name: string; home_flag_url: string | null; away_team_id: string; away_team_name: string; away_flag_url: string | null; kickoff: string; stage: string; group: string | null }[] = [];

    if (scope === "single") {
      if (!fixtureIds || fixtureIds.length !== 1) {
        throw new ApiError(400, "FIXTURES_REQUIRED", "Single-scope pool requires exactly one fixture");
      }
      const fixture = await getFixtureById(fixtureIds[0]);
      finalMaxMembers = 2;
      const homeTeam = (await getAllTeams()).find((t) => t.id === fixture.homeTeamId);
      const awayTeam = (await getAllTeams()).find((t) => t.id === fixture.awayTeamId);
      poolFixturesToInsert = [{
        fixture_id: fixture.id,
        home_team_id: fixture.homeTeamId,
        home_team_name: homeTeam?.name ?? fixture.homeTeamName,
        home_flag_url: homeTeam?.flagUrl ?? fixture.homeFlagUrl ?? null,
        away_team_id: fixture.awayTeamId,
        away_team_name: awayTeam?.name ?? fixture.awayTeamName,
        away_flag_url: awayTeam?.flagUrl ?? fixture.awayFlagUrl ?? null,
        kickoff: fixture.kickoff,
        stage: fixture.stage,
        group: fixture.group,
      }];
    } else if (scope === "custom") {
      if (!fixtureIds || fixtureIds.length < 1) {
        throw new ApiError(400, "FIXTURES_REQUIRED", "Custom-scope pool requires at least one fixture");
      }
      if (fixtureIds.length > 32) {
        throw new ApiError(400, "TOO_MANY_FIXTURES", "Custom-scope pool supports up to 32 fixtures");
      }
      const allTeams = await getAllTeams();
      const uniqueTeamIds = new Set<string>();
      for (const fid of fixtureIds) {
        const fixture = await getFixtureById(fid);
        uniqueTeamIds.add(fixture.homeTeamId);
        uniqueTeamIds.add(fixture.awayTeamId);
        const homeTeam = allTeams.find((t) => t.id === fixture.homeTeamId);
        const awayTeam = allTeams.find((t) => t.id === fixture.awayTeamId);
        poolFixturesToInsert.push({
          fixture_id: fixture.id,
          home_team_id: fixture.homeTeamId,
          home_team_name: homeTeam?.name ?? fixture.homeTeamName,
          home_flag_url: homeTeam?.flagUrl ?? fixture.homeFlagUrl ?? null,
          away_team_id: fixture.awayTeamId,
          away_team_name: awayTeam?.name ?? fixture.awayTeamName,
          away_flag_url: awayTeam?.flagUrl ?? fixture.awayFlagUrl ?? null,
          kickoff: fixture.kickoff,
          stage: fixture.stage,
          group: fixture.group,
        });
      }
      finalMaxMembers = Math.min(uniqueTeamIds.size, 32);
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
        max_members: finalMaxMembers,
        escrow_pda: escrowPda,
        status: "waiting",
        is_private: isPrivate,
        passphrase: isPrivate ? (passphrase ?? null) : null,
        scope,
      })
      .select()
      .single();

    if (error || !pool) {
      logger.error("Failed to create pool", { error, wallet });
      throw new ApiError(500, "POOL_CREATE_FAILED", "Failed to create pool");
    }

    if (poolFixturesToInsert.length > 0) {
      const { error: fixturesError } = await supabaseAdmin
        .from("pool_fixtures")
        .insert(
          poolFixturesToInsert.map((f) => ({
            pool_id: poolId,
            ...f,
          })),
        );
      if (fixturesError) {
        logger.error("Failed to insert pool_fixtures", { error: fixturesError, poolId });
        throw new ApiError(500, "FIXTURES_INSERT_FAILED", "Failed to save pool fixtures");
      }
    }

    const availableTeams = await getPoolAvailableTeams(poolId, scope);

    await callInitializePool(poolId, entryFeeUsdc, finalMaxMembers, scope).catch((e) => {
      logger.error("Pool init on-chain failed (non-fatal)", { poolId, error: String(e) });
    });

    await publishPoolUpdate(pool.id, {
      type: "heartbeat",
      poolId: pool.id,
      timestamp: Date.now(),
      data: { action: "created", wallet, scope, fixtureCount: poolFixturesToInsert.length },
    });

    logger.info("Pool created", { poolId: pool.id, wallet, joinCode, scope, fixtureCount: poolFixturesToInsert.length });

    return Response.json({
      pool: {
        id: pool.id,
        name: pool.name,
        joinCode: pool.join_code,
        status: pool.status,
        entryFeeUsdc: Number(pool.entry_fee_usdc),
        maxMembers: pool.max_members,
        scope,
        escrowPda: pool.escrow_pda,
        createdAt: pool.created_at,
        isPrivate: pool.is_private,
        passphrase: pool.passphrase,
      },
      joinUrl: `${env.NEXT_PUBLIC_APP_URL}/join/${joinCode}`,
      availableTeams: availableTeams.map((t) => ({
        teamId: t.teamId,
        teamName: t.teamName,
        flagUrl: t.flagUrl,
      })),
      fixtureCount: poolFixturesToInsert.length,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
