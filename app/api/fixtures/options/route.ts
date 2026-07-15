import { z } from "zod";
import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError, ApiError } from "@/lib/errors";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getAllTeams } from "@/lib/txline";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const responseSchema = z.object({
  grouped: z.array(
    z.object({
      stage: z.string(),
      stageKey: z.string(),
      fixtures: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          homeTeam: z.object({
            id: z.string(),
            name: z.string(),
            flagUrl: z.string().optional(),
          }),
          awayTeam: z.object({
            id: z.string(),
            name: z.string(),
            flagUrl: z.string().optional(),
          }),
          kickoff: z.string(),
          stage: z.string(),
          group: z.string().nullable(),
          status: z.enum(["scheduled", "live", "finished"]),
        })
      ),
    })
  ),
  all: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      homeTeam: z.object({
        id: z.string(),
        name: z.string(),
        flagUrl: z.string().optional(),
      }),
      awayTeam: z.object({
        id: z.string(),
        name: z.string(),
        flagUrl: z.string().optional(),
      }),
      kickoff: z.string(),
      stage: z.string(),
      group: z.string().nullable(),
      status: z.enum(["scheduled", "live", "finished"]),
    })
  ),
  totalCount: z.number(),
});

export async function GET(request: Request) {
  try {
    await withRateLimit(request, 30, "1m");

    const cacheKey = "fixtures:options";
    const cached = await cacheGet(cacheKey, z.any());
    if (cached) {
      return Response.json(cached);
    }

    const allTeams = await getAllTeams();
    const fixturesOptions = buildFixtureOptions(allTeams);

    const groupedMap = new Map<string, (typeof responseSchema.shape.grouped)[0][]>();
    const stageOrder = ["Group Stage", "Round of 16", "Quarterfinals", "Semifinals", "Final"];
    
    for (const opt of fixturesOptions) {
      const stageMap = stageOrder.find((s) => opt.stage.toLowerCase().includes(s.toLowerCase().replace(" ", "")));
      const stageKey = stageMap || "Other";
      if (!groupedMap.has(stageKey)) {
        groupedMap.set(stageKey, []);
      }
      groupedMap.get(stageKey)!.push(opt);
    }

    const grouped = Array.from(groupedMap.entries())
      .map(([stage, fixtures]) => ({
        stage,
        stageKey: stage.toLowerCase().replace(" ", ""),
        fixtures,
      }))
      .sort((a, b) => {
        const orderA = stageOrder.indexOf(a.stage);
        const orderB = stageOrder.indexOf(b.stage);
        if (orderA === -1 && orderB === -1) return 0;
        if (orderA === -1) return 1;
        if (orderB === -1) return -1;
        return orderA - orderB;
      });

    const result = {
      grouped,
      all: fixturesOptions,
      totalCount: fixturesOptions.length,
    };

    await cacheSet(cacheKey, result, 300);

    return Response.json(result);
  } catch (e) {
    return handleRouteError(e);
  }
}

function buildFixtureOptions(allTeams: any[]): any[] {
  const homeTeamCache = new Map<string, any>();
  const awayTeamCache = new Map<string, any>();

  for (const team of allTeams) {
    homeTeamCache.set(team.id, team);
    awayTeamCache.set(team.id, team);
  }

  const fixturesOptions: any[] = [];

  allTeams.forEach((homeTeam) => {
    allTeams.forEach((awayTeam) => {
      if (homeTeam.id === awayTeam.id) return;

      const fixtureId = `fixture_${homeTeam.id}_${awayTeam.id}`;
      const phase = "Group Stage";
      const kickoff = new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
      const status = "scheduled";
      const group = "A";

      const label = `${homeTeam.name} vs ${awayTeam.name} • ${phase} • ${group}`;

      fixturesOptions.push({
        id: fixtureId,
        label,
        homeTeam: {
          id: homeTeam.id,
          name: homeTeam.name,
          flagUrl: homeTeam.flagUrl || `https://flagsapi.com/${homeTeam.id}/flat/64.png`,
        },
        awayTeam: {
          id: awayTeam.id,
          name: awayTeam.name,
          flagUrl: awayTeam.flagUrl || `https://flagsapi.com/${awayTeam.id}/flat/64.png`,
        },
        kickoff,
        stage: phase,
        group,
        status,
      });
    });
  });

  return fixturesOptions;
}