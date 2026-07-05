import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase";
import { computeLeaderboard } from "@/lib/pools";
import { cacheGet, cacheSet } from "@/lib/redis";
import { z } from "zod";
import type { ScoreEventFeed } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ joinCode: string }> },
) {
  try {
    await withRateLimit(request, 120, "1m");

    const { joinCode } = await params;

    const { data: pool, error: poolError } = await supabaseAdmin
      .from("pools")
      .select("id, status")
      .eq("join_code", joinCode)
      .single();

    if (poolError || !pool) {
      throw new ApiError(404, "POOL_NOT_FOUND", "Pool not found");
    }

    const cacheKey = `leaderboard:${pool.id}`;
    const cached = await cacheGet(cacheKey, z.any());
    if (cached) {
      return Response.json(cached);
    }

    const leaderboard = await computeLeaderboard(pool.id);

    const { data: recentEvents } = await supabaseAdmin
      .from("score_events")
      .select(
        "points_awarded, event_type, minute, player_name, created_at, pool_members!inner(display_name, team_name, team_flag_url)",
      )
      .eq("pool_id", pool.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const feed: ScoreEventFeed[] = (recentEvents ?? []).map((e) => ({
      memberName: (e as any).pool_members?.display_name ?? "Unknown",
      teamName: (e as any).pool_members?.team_name ?? "",
      teamFlagUrl: (e as any).pool_members?.team_flag_url ?? null,
      eventType: e.event_type,
      minute: e.minute,
      playerName: e.player_name,
      pointsAwarded: e.points_awarded,
      createdAt: e.created_at,
    }));

    const response = {
      leaderboard,
      recentEvents: feed,
      lastUpdated: new Date().toISOString(),
      poolStatus: pool.status,
    };

    await cacheSet(cacheKey, response, 5);

    return Response.json(response);
  } catch (e) {
    return handleRouteError(e);
  }
}
