import { z } from "zod";
import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase";
import { txline } from "@/lib/txline";
import { getAllTeams } from "@/lib/txline";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  wallet: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ joinCode: string }> },
) {
  try {
    const { joinCode } = await params;
    await withRateLimit(request, 60, "1m");

    const { data: pool, error: poolError } = await supabaseAdmin
      .from("pools")
      .select("*, scope")
      .eq("join_code", joinCode)
      .single();

    if (poolError || !pool) {
      throw new ApiError(404, "POOL_NOT_FOUND", "Pool not found");
    }

    if (pool.status === "settled" || pool.status === "onchain_failed") {
      throw new ApiError(409, "POOL_SETTLED", "This pool has already been settled or failed");
    }

    let availableTeams: any[] = [];
    let scope = pool.scope || "all";

    if (scope === "all") {
      availableTeams = await txline.getAllTeams();
    } else {
      const { data: poolFixtures, error: fixturesError } = await supabaseAdmin
        .from("pool_fixtures")
        .select("*, home_team_id, away_team_id")
        .eq("pool_id", pool.id);

      if (fixturesError) {
        logger.error("Failed to fetch pool fixtures", { error: fixturesError });
        throw new ApiError(500, "FIXTURES_FETCH_FAILED", "Failed to fetch pool fixtures");
      }

      const fixtureIds = poolFixtures?.map((f) => f.fixture_id) || [];
      if (fixtureIds.length === 0) {
        availableTeams = await txline.getAllTeams();
        scope = "all";
      } else {
        const uniqueTeamIds = new Set<string>();
        for (const fixtureId of fixtureIds) {
          const fixture = await txline.getFixtureById(fixtureId);
          if (fixture) {
            uniqueTeamIds.add(fixture.homeTeamId);
            uniqueTeamIds.add(fixture.awayTeamId);
          }
        }

        availableTeams = await Promise.all(
          Array.from(uniqueTeamIds).map(async (teamId) => {
            const team = await txline.getTeamById(teamId);
            return team || null;
          })
        ).then((teams) => teams.filter((team) => team !== null) as any[]);
      }
    }

    const { data: takenMembers } = await supabaseAdmin
      .from("pool_members")
      .select("team_id, display_name")
      .eq("pool_id", pool.id);

    const takenTeamIds = new Set(takenMembers?.map((m) => m.team_id) || []);

    const teamsWithStatus = availableTeams.map((team) => {
      const isTaken = takenTeamIds.has(team.id);
      const takenBy = takenMembers?.find((m) => m.team_id === team.id)?.display_name || null;

      return {
        teamId: team.id,
        teamName: team.name,
        flagUrl: team.flagUrl || `https://flagsapi.com/${team.id}/flat/64.png`,
        group: team.group,
        isTaken,
        takenBy,
        fixture: null,
      };
    });

    teamsWithStatus.sort((a, b) => {
      if (a.isTaken && !b.isTaken) return 1;
      if (!a.isTaken && b.isTaken) return -1;
      return 0;
    });

    return Response.json({
      teams: teamsWithStatus,
      scope,
      totalTeams: availableTeams.length,
      takenCount: takenTeamIds.size,
      availableCount: availableTeams.length - takenTeamIds.size,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}