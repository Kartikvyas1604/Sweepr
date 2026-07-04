import { env } from "./env";
import { redis, cacheGet, cacheSet } from "./redis";
import { ApiError } from "./errors";
import { logger } from "./logger";
import {
  TxLINETeamSchema,
  TxLINEFixtureSchema,
  TxLINEEventSchema,
  TxLINEStandingsSchema,
  type TxLINETeam,
  type TxLINEFixture,
  type TxLINEEvent,
  type TxLINEStandings,
} from "@/types/txline";
import { z } from "zod";

class TxLINEError extends ApiError {
  constructor(message: string, status = 502) {
    super(status, "TXLINE_ERROR", message);
  }
}

async function fetchFromTxLINE<T>(
  path: string,
  schema: z.ZodSchema<T>,
): Promise<T> {
  const apiKey = env.TXLINE_API_KEY;
  if (!apiKey) {
    throw new TxLINEError(
      "TXLINE_API_KEY not configured. Get one at https://txline.txodds.com (free tier available)",
    );
  }
  const url = `${env.TXLINE_BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error("TxLINE API error", {
      path,
      status: response.status,
      body,
    });
    throw new TxLINEError(
      `TxLINE returned ${response.status}: ${body.slice(0, 200)}`,
    );
  }

  const json = await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    logger.error("TxLINE response parse error", {
      path,
      error: parsed.error.message,
    });
    throw new TxLINEError("Invalid response from TxLINE");
  }

  return parsed.data;
}

export async function getAllTeams(): Promise<TxLINETeam[]> {
  const cacheKey = "txline:teams:all";
  const cached = await cacheGet(cacheKey, z.array(TxLINETeamSchema));
  if (cached) return cached;

  const teams = await fetchFromTxLINE(
    "/worldcup/teams",
    z.array(TxLINETeamSchema),
  );
  await cacheSet(cacheKey, teams, 86400);
  return teams;
}

export async function getFixtures(): Promise<TxLINEFixture[]> {
  const cacheKey = "txline:fixtures:all";
  const cached = await cacheGet(cacheKey, z.array(TxLINEFixtureSchema));
  if (cached) return cached;

  const fixtures = await fetchFromTxLINE(
    "/worldcup/fixtures",
    z.array(TxLINEFixtureSchema),
  );
  await cacheSet(cacheKey, fixtures, 300);
  return fixtures;
}

export async function getLiveFixtures(): Promise<TxLINEFixture[]> {
  const cacheKey = "txline:fixtures:live";
  const cached = await cacheGet(cacheKey, z.array(TxLINEFixtureSchema));
  if (cached) return cached;

  const fixtures = await fetchFromTxLINE(
    "/worldcup/fixtures/live",
    z.array(TxLINEFixtureSchema),
  );
  await cacheSet(cacheKey, fixtures, 30);
  return fixtures;
}

export async function getFixtureEvents(
  fixtureId: string,
): Promise<TxLINEEvent[]> {
  const cacheKey = `txline:events:${fixtureId}`;
  const cached = await cacheGet(cacheKey, z.array(TxLINEEventSchema));
  if (cached) return cached;

  const events = await fetchFromTxLINE(
    `/worldcup/fixtures/${fixtureId}/events`,
    z.array(TxLINEEventSchema),
  );
  const filtered = events.filter(
    (e) => e.type === "goal" || e.type === "own_goal" || e.type === "penalty",
  );
  await cacheSet(cacheKey, filtered, 20);
  return filtered;
}

export async function getStandings(): Promise<TxLINEStandings[]> {
  const cacheKey = "txline:standings";
  const cached = await cacheGet(cacheKey, z.array(TxLINEStandingsSchema));
  if (cached) return cached;

  const standings = await fetchFromTxLINE(
    "/worldcup/standings",
    z.array(TxLINEStandingsSchema),
  );
  await cacheSet(cacheKey, standings, 300);
  return standings;
}

export async function getTeamById(
  teamId: string,
): Promise<TxLINETeam | null> {
  const teams = await getAllTeams();
  return teams.find((t) => t.id === teamId) ?? null;
}

export function computePointsForEvent(event: TxLINEEvent): number {
  switch (event.type) {
    case "goal":
      return 3;
    case "penalty":
      return 3;
    case "own_goal":
      return 1;
    default:
      return 0;
  }
}
