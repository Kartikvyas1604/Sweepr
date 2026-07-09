import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAllTeams,
  getFixtures,
  getLiveFixtures,
  getFixtureEvents,
  getTeamById,
  computePointsForEvent,
} from "@/lib/txline";
import type { TxLINETeam, TxLINEEvent } from "@/types/txline";

vi.mock("@/lib/redis", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cors", () => ({
  corsHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/env", () => ({
  env: {
    TXLINE_API_KEY: "test-api-key",
    TXLINE_BASE_URL: "https://txline.test.com",
  },
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

// Helper to mock the guest JWT endpoint + data endpoint sequentially
function mockTxLINEFetch(dataEndpoint: string, responseData: unknown) {
  let callCount = 0;
  global.fetch = vi.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
    callCount++;
    // First call is always guest JWT (POST /auth/guest/start)
    if (url.toString().includes("/auth/guest/start")) {
      return {
        ok: true,
        json: () => Promise.resolve({ token: "test-jwt" }),
      };
    }
    // Subsequent calls are data endpoints
    return {
      ok: true,
      json: () => Promise.resolve(responseData),
    };
  });
}

function mockTxLINEFetchError(status: number, body: string) {
  let callCount = 0;
  global.fetch = vi.fn().mockImplementation(async (url: string) => {
    callCount++;
    if (url.includes("/auth/guest/start")) {
      return {
        ok: true,
        json: () => Promise.resolve({ token: "test-jwt" }),
      };
    }
    return {
      ok: false,
      status,
      text: () => Promise.resolve(body),
    };
  });
}

describe("getAllTeams", () => {
  it("returns teams from mock data (no external API call)", async () => {
    const teams = await getAllTeams();
    expect(teams.length).toBeGreaterThanOrEqual(32);
    expect(teams.some((t) => t.name === "Brazil")).toBe(true);
    expect(teams.some((t) => t.name === "France")).toBe(true);
  });
});

describe("getFixtures", () => {
  it("returns mapped fixtures from TxLINE", async () => {
    mockTxLINEFetch("/api/fixtures/snapshot", [
      {
        FixtureId: 18209181,
        Participant1Id: 1999,
        Participant2Id: 2530,
        Participant1: "France",
        Participant2: "Morocco",
        StartTime: 1783627200000,
        GameState: 1,
      },
    ]);
    const fixtures = await getFixtures();
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].homeTeamName).toBe("France");
    expect(fixtures[0].awayTeamName).toBe("Morocco");
    expect(fixtures[0].status).toBe("scheduled");
  });

  it("returns empty array on API failure", async () => {
    mockTxLINEFetchError(500, "Server error");
    await expect(getFixtures()).rejects.toThrow();
  });
});

describe("getLiveFixtures", () => {
  it("returns only live fixtures", async () => {
    mockTxLINEFetch("/api/fixtures/snapshot", [
      {
        FixtureId: 1,
        Participant1Id: 1,
        Participant2Id: 2,
        Participant1: "A", Participant2: "B",
        StartTime: 1783627200000,
        GameState: 2, // live
      },
      {
        FixtureId: 2,
        Participant1Id: 3,
        Participant2Id: 4,
        Participant1: "C", Participant2: "D",
        StartTime: 1783627200000,
        GameState: 1, // scheduled
      },
    ]);
    const live = await getLiveFixtures();
    expect(live).toHaveLength(1);
    expect(live[0].status).toBe("live");
  });
});

describe("getFixtureEvents", () => {
  it("returns filtered events from scores snapshot", async () => {
    mockTxLINEFetch("/api/scores/snapshot/f1", [
      { FixtureId: 1, Action: "goal", Data: { Minute: 10, Player: "Neymar" }, Participant1Id: 1, Participant2Id: 2, GameState: "live" },
      { FixtureId: 1, Action: "goal", Data: { Minute: 20, Player: "Messi" }, Participant1Id: 2, Participant2Id: 1, GameState: "live" },
      { FixtureId: 1, Action: "goal", Data: { Minute: 30, Player: "Neymar" }, Participant1Id: 1, Participant2Id: 2, GameState: "live" },
      { FixtureId: 1, Action: "own_goal", Data: { Minute: 40, Player: "Neymar" }, Participant1Id: 1, Participant2Id: 2, GameState: "live" },
      { FixtureId: 1, Action: "penalty", Data: { Minute: 50, Player: "Mbappe" }, Participant1Id: 2, Participant2Id: 1, GameState: "live" },
      { FixtureId: 1, Action: "yellow_card", Data: { Minute: 60, Player: "Neymar" }, Participant1Id: 1, Participant2Id: 2, GameState: "live" },
      { FixtureId: 1, Action: "red_card", Data: { Minute: 70, Player: "Neymar" }, Participant1Id: 1, Participant2Id: 2, GameState: "live" },
    ]);
    const events = await getFixtureEvents("f1");
    expect(events).toHaveLength(5); // 3 goals + 1 own_goal + 1 penalty
    for (const evt of events) {
      expect(["goal", "own_goal", "penalty"]).toContain(evt.type);
    }
  });

  it("returns empty array on API failure (graceful)", async () => {
    mockTxLINEFetchError(500, "Server error");
    const events = await getFixtureEvents("nonexistent");
    expect(events).toEqual([]);
  });
});

describe("getTeamById", () => {
  it("returns null for nonexistent team", async () => {
    const team = await getTeamById("ZZZ");
    expect(team).toBeNull();
  });

  it("returns matching team from mock data", async () => {
    const team = await getTeamById("BRA");
    expect(team).not.toBeNull();
    expect(team!.name).toBe("Brazil");
  });
});

describe("computePointsForEvent", () => {
  it("returns 3 for a goal", () => {
    const evt: TxLINEEvent = { id: "e1", fixtureId: "f1", teamId: "T1", type: "goal", minute: 10, playerName: "X", detail: null };
    expect(computePointsForEvent(evt)).toBe(3);
  });

  it("returns 3 for a penalty", () => {
    const evt: TxLINEEvent = { id: "e2", fixtureId: "f1", teamId: "T1", type: "penalty", minute: 10, playerName: "X", detail: null };
    expect(computePointsForEvent(evt)).toBe(3);
  });

  it("returns 1 for an own_goal", () => {
    const evt: TxLINEEvent = { id: "e3", fixtureId: "f1", teamId: "T1", type: "own_goal", minute: 10, playerName: "X", detail: null };
    expect(computePointsForEvent(evt)).toBe(1);
  });

  it("returns 0 for yellow_card", () => {
    const evt: TxLINEEvent = { id: "e4", fixtureId: "f1", teamId: "T1", type: "yellow_card", minute: 10, playerName: "X", detail: null };
    expect(computePointsForEvent(evt)).toBe(0);
  });

  it("returns 0 for red_card", () => {
    const evt: TxLINEEvent = { id: "e5", fixtureId: "f1", teamId: "T1", type: "red_card", minute: 10, playerName: "X", detail: null };
    expect(computePointsForEvent(evt)).toBe(0);
  });
});
