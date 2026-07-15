import { env } from "./env";
import { cacheGet, cacheSet } from "./redis";
import { ApiError } from "./errors";
import { logger } from "./logger";
import { getMockTeams } from "./mock-data";
import type { TxLINETeam, TxLINEFixture, TxLINEEvent, TxLINEStandings } from "@/types/txline";
import { z } from "zod";

class TxLINEError extends ApiError {
  constructor(message: string, status = 502) {
    super(status, "TXLINE_ERROR", message);
  }
}

const WORLD_CUP_COMPETITION_ID = 72;

// Guest JWT is short-lived (30 days), cache and auto-refresh
let guestJwtPromise: Promise<string> | null = null;

async function getGuestJwt(): Promise<string> {
  const url = `${env.TXLINE_BASE_URL}/auth/guest/start`;
  const res = await fetch(url, { method: "POST", headers: { Accept: "application/json" } });
  if (!res.ok) throw new TxLINEError(`Guest JWT request failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}

function getOrRefreshJwt(): Promise<string> {
  if (!guestJwtPromise) {
    guestJwtPromise = getGuestJwt().catch((e) => {
      guestJwtPromise = null;
      throw e;
    });
  }
  return guestJwtPromise;
}

function invalidateJwt() {
  guestJwtPromise = null;
}

async function fetchFromTxLINE<T>(
  path: string,
  schema: z.ZodSchema<T>,
): Promise<T> {
  const apiToken = env.TXLINE_API_KEY;
  if (!apiToken) {
    throw new TxLINEError(
      "TXLINE_API_KEY not configured. Get one at https://txline.txodds.com (free tier available)",
    );
  }

  const doFetch = async (jwt: string): Promise<Response> => {
    const url = `${env.TXLINE_BASE_URL}${path}`;
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "X-Api-Token": apiToken,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
  };

  const jwt = await getOrRefreshJwt();
  let response = await doFetch(jwt);

  // If 401, the guest JWT expired — refresh and retry once
  if (response.status === 401) {
    logger.info("TxLINE guest JWT expired, refreshing");
    invalidateJwt();
    const freshJwt = await getOrRefreshJwt();
    response = await doFetch(freshJwt);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logger.error("TxLINE API error", { path, status: response.status, body });
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

// --- New API response schemas (raw from TxLINE) ---

const NewFixtureSchema = z.object({
  FixtureId: z.number(),
  Participant1Id: z.number(),
  Participant2Id: z.number(),
  Participant1: z.string(),
  Participant2: z.string(),
  StartTime: z.number(),
  GameState: z.number(),
});

const NewFixtureArraySchema = z.array(NewFixtureSchema);

// --- Teams ---
// TxLINE v2 has no standalone teams endpoint.
// Use the embedded mock data which covers the 32-team World Cup format.

export async function getAllTeams(): Promise<TxLINETeam[]> {
  const cacheKey = "txline:teams:all";
  const cached = await cacheGet(cacheKey, z.array(z.any())); // Skip zod validation for cached mock data
  if (cached) return cached as TxLINETeam[];

  const teams = getMockTeams();
  await cacheSet(cacheKey, teams, 86400);
  return teams;
}

function gameStateToStatus(state: number): TxLINEFixture["status"] {
  switch (state) {
    case 2: return "live";
    case 3: return "finished";
    case 4: return "postponed";
    default: return "scheduled";
  }
}

const fixtureIdToStr = (id: number): string => String(id);
const tsToIso = (ts: number): string => new Date(ts).toISOString();

// --- Fixtures ---

export async function getFixtures(): Promise<TxLINEFixture[]> {
  const cacheKey = "txline:fixtures:all";
  const cached = await cacheGet(cacheKey, z.array(z.any()));
  if (cached) return cached as TxLINEFixture[];

  const raw = await fetchFromTxLINE(
    `/api/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}`,
    NewFixtureArraySchema,
  );

  const fixtures: TxLINEFixture[] = raw.map((f) => ({
    id: fixtureIdToStr(f.FixtureId),
    homeTeamId: String(f.Participant1Id),
    awayTeamId: String(f.Participant2Id),
    homeTeamName: f.Participant1,
    awayTeamName: f.Participant2,
    homeScore: 0,
    awayScore: 0,
    status: gameStateToStatus(f.GameState),
    kickoff: tsToIso(f.StartTime),
    minute: null,
    stage: "",
    group: null,
  }));

  await cacheSet(cacheKey, fixtures, 300);
  return fixtures;
}

export async function getLiveFixtures(): Promise<TxLINEFixture[]> {
  const all = await getFixtures();
  return all.filter((f) => f.status === "live");
}

// --- Fixture Events ---

const NewScoreEventSchema = z.object({
  FixtureId: z.number(),
  Action: z.string(),
  Data: z.record(z.unknown()).default({}),
  Participant1Id: z.number(),
  Participant2Id: z.number(),
  Participant1: z.string().optional(),
  Participant2: z.string().optional(),
  GameState: z.union([z.string(), z.number()]),
});

const NewScoreEventArraySchema = z.array(NewScoreEventSchema);

export async function getFixtureEvents(
  fixtureId: string,
): Promise<TxLINEEvent[]> {
  const cacheKey = `txline:events:${fixtureId}`;
  const cached = await cacheGet(cacheKey, z.array(z.any()));
  if (cached) return cached as TxLINEEvent[];

  const raw = await fetchFromTxLINE(
    `/api/scores/snapshot/${fixtureId}`,
    NewScoreEventArraySchema,
  ).catch(() => []);

  const events: TxLINEEvent[] = raw
    .filter((e) => e.Action === "goal" || e.Action === "own_goal" || e.Action === "penalty")
    .map((e, i) => {
      const data = e.Data ?? {};
      return {
        id: `${fixtureId}_${i}`,
        fixtureId,
        teamId: String(e.Participant1Id),
        type: mapActionToEventType(e.Action),
        minute: (data as any).Minute ?? 0,
        playerName: (data as any).Player ?? null,
        detail: (data as any).Detail ?? null,
      };
    });

  await cacheSet(cacheKey, events, 20);
  return events;
}

function mapActionToEventType(
  action: string,
): TxLINEEvent["type"] {
  switch (action) {
    case "goal": return "goal";
    case "own_goal": return "own_goal";
    case "penalty": return "penalty";
    default: return "goal";
  }
}

// --- Standings ---
// TxLINE v2 has no standalone standings endpoint.
// Return empty array — standings are derived from fixture results.

export async function getStandings(): Promise<TxLINEStandings[]> {
  const cacheKey = "txline:standings";
  const cached = await cacheGet(cacheKey, z.array(z.any()));
  if (cached) return cached as TxLINEStandings[];

  const standings: TxLINEStandings[] = [];
  await cacheSet(cacheKey, standings, 300);
  return standings;
}

// --- Convenience helpers ---

export async function getTeamById(
  teamId: string,
): Promise<TxLINETeam | null> {
  const teams = await getAllTeams();
  return teams.find((t) => t.id === teamId) ?? null;
}

export function computePointsForEvent(event: TxLINEEvent): number {
  switch (event.type) {
    case "goal": return 3;
    case "penalty": return 3;
    case "own_goal": return 1;
    default: return 0;
  }
}

// --- Fixture methods ---
export async function getFixtureById(fixtureId: string): Promise<TxLINEFixture> {
  const cacheKey = `txline:fixture:${fixtureId}`;

  const cached = await cacheGet(cacheKey, z.any());
  if (cached) return cached as TxLINEFixture;

  const allFixtures = await getFixtures();
  const fixture = allFixtures.find((f) => f.id === fixtureId);

  if (!fixture) {
    throw new TxLINEError(`Fixture not found: ${fixtureId}`);
  }

  if (fixture.status === "finished") {
    throw new TxLINEError(`Fixture already finished: ${fixtureId}`);
  }

  await cacheSet(cacheKey, fixture, 300);
  return fixture;
}

export async function getFixturesByStage(stage: string): Promise<TxLINEFixture[]> {
  const allFixtures = await getFixtures();
  return allFixtures.filter((f) => f.stage === stage);
}

export async function getFixturesByGroup(group: string): Promise<TxLINEFixture[]> {
  const allFixtures = await getFixtures();
  return allFixtures.filter((f) => f.group === group);
}

export async function getTeamsForFixtures(fixtureIds: string[]): Promise<TxLINETeam[]> {
  const fixtures = await Promise.all(
    fixtureIds.map(async (id) => await getFixtureById(id))
  );

  const uniqueTeamIds = new Set<string>();
  for (const f of fixtures) {
    uniqueTeamIds.add(f.homeTeamId);
    uniqueTeamIds.add(f.awayTeamId);
  }

  const teams = await Promise.all(
    Array.from(uniqueTeamIds).map(async (teamId) => {
      return await getTeamById(teamId);
    })
  );

  return teams.filter((team): team is TxLINETeam => team !== null);
}
