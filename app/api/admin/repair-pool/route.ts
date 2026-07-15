import { z } from "zod";
import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase";
import { getAllTeams, getFixtureById } from "@/lib/txline";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  poolId: z.string(),
  scope: z.enum(["all", "single", "custom"]),
  fixtureIds: z.array(z.string()).optional(),
});

export async function POST(
  request: Request,
) {
  try {
    await withRateLimit(request, 60, "1m");

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return handleRouteError(parsed.error);
    }

    const { poolId, scope, fixtureIds } = parsed.data;

    const { data: pool, error: poolError } = await supabaseAdmin
      .from("pools")
      .select("*, scope")
      .eq("id", poolId)
      .single();

    if (poolError || !pool) {
      throw new ApiError(404, "POOL_NOT_FOUND", "Pool not found");
    }

    if (pool.status === "settled" || pool.status === "onchain_failed") {
      throw new ApiError(409, "POOL_SETTLED", "This pool has already been settled or failed");
    }

    await supabaseAdmin
      .from("pool_fixtures")
      .delete()
      .eq("pool_id", poolId);

    if (fixtureIds && fixtureIds.length > 0) {
      const fixtures = await Promise.all(
        fixtureIds.map(async (fixtureId) => {
          const fixture = await getFixtureById(fixtureId);
          return {
            pool_id: poolId,
            fixture_id: fixture.id,
            home_team_id: fixture.homeTeamId,
            away_team_id: fixture.awayTeamId,
            home_team_name: fixture.homeTeamName,
            away_team_name: fixture.awayTeamName,
            home_flag_url: fixture.homeFlagUrl || null,
            away_flag_url: fixture.awayFlagUrl || null,
            kickoff: fixture.kickoff,
            stage: fixture.stage,
            group_name: fixture.group || null,
          };
        })
      );

      const { error: insertError } = await supabaseAdmin
        .from("pool_fixtures")
        .insert(fixtures);

      if (insertError) {
        logger.error("Failed to insert pool fixtures", { error: insertError, poolId });
        throw new ApiError(500, "FIXTURES_INSERT_FAILED", "Failed to insert pool fixtures");
      }
    }

    const { data: updatedPool } = await supabaseAdmin
      .from("pools")
      .update({ scope })
      .eq("id", poolId)
      .select()
      .single();

    const fixtureCount = fixtureIds?.length || 0;
    const uniqueTeams = new Set<string>();
    
    if (fixtureIds && fixtureIds.length > 0) {
      const { data: poolFixtures } = await supabaseAdmin
        .from("pool_fixtures")
        .select("home_team_id, away_team_id")
        .eq("pool_id", poolId);

      for (const fixture of poolFixtures || []) {
        uniqueTeams.add(fixture.home_team_id);
        uniqueTeams.add(fixture.away_team_id);
      }
    } else if (scope === "all") {
      const allTeams = await getAllTeams();
      for (const team of allTeams) {
        uniqueTeams.add(team.id);
      }
    }

    const maxMembers = scope === "all" ? 32 : uniqueTeams.size;

    await supabaseAdmin
      .from("pools")
      .update({ max_members: maxMembers })
      .eq("id", poolId)
      .single();

    return Response.json({
      success: true,
      pool: updatedPool,
      fixtureCount,
      uniqueTeams: uniqueTeams.size,
      maxMembers,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}