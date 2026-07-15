import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase";
import { getPoolTeamsWithStatus } from "@/lib/pools";
import type { pool_scope } from "@/lib/pools";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ joinCode: string }> },
) {
  try {
    const { joinCode } = await params;
    await withRateLimit(request, 60, "1m");

    const { data: pool, error: poolError } = await supabaseAdmin
      .from("pools")
      .select("id, status, scope")
      .eq("join_code", joinCode)
      .single();

    if (poolError || !pool) {
      throw new ApiError(404, "POOL_NOT_FOUND", "Pool not found");
    }

    if (pool.status === "settled" || pool.status === "onchain_failed") {
      throw new ApiError(409, "POOL_SETTLED", "This pool has already been settled or failed");
    }

    const scope = (pool.scope || "all") as pool_scope;
    const teamsWithStatus = await getPoolTeamsWithStatus(pool.id, scope);

    const teams = teamsWithStatus.map((t) => ({
      teamId: t.teamId,
      teamName: t.teamName,
      flagUrl: t.flagUrl,
      group: t.group,
      isTaken: t.isTaken,
      takenBy: t.takenBy,
      fixture: t.fixtureId
        ? {
            fixtureId: t.fixtureId,
            opponentName: t.opponentName,
            kickoff: t.kickoff,
          }
        : null,
    }));

    const takenCount = teams.filter((t) => t.isTaken).length;

    return Response.json({
      teams,
      scope,
      totalTeams: teams.length,
      takenCount,
      availableCount: teams.length - takenCount,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
