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

const mockTeams: TxLINETeam[] = [
  { id: "BRA", name: "Brazil", shortName: "Brazil", flagUrl: "", group: "A", fifaRanking: 3 },
  { id: "ARG", name: "Argentina", shortName: "Argentina", flagUrl: "", group: "A", fifaRanking: 1 },
  { id: "FRA", name: "France", shortName: "France", flagUrl: "", group: "B", fifaRanking: 2 },
];

const mockEvents: TxLINEEvent[] = [
  { id: "e1", fixtureId: "f1", teamId: "BRA", type: "goal", minute: 10, playerName: "Neymar", detail: null },
  { id: "e2", fixtureId: "f1", teamId: "ARG", type: "goal", minute: 20, playerName: "Messi", detail: null },
  { id: "e3", fixtureId: "f1", teamId: "BRA", type: "goal", minute: 30, playerName: "Neymar", detail: null },
  { id: "e4", fixtureId: "f1", teamId: "BRA", type: "own_goal", minute: 40, playerName: "Neymar", detail: null },
  { id: "e5", fixtureId: "f1", teamId: "FRA", type: "penalty", minute: 50, playerName: "Mbappe", detail: null },
  { id: "e6", fixtureId: "f1", teamId: "BRA", type: "yellow_card", minute: 60, playerName: "Neymar", detail: null },
  { id: "e7", fixtureId: "f1", teamId: "BRA", type: "red_card", minute: 70, playerName: "Neymar", detail: null },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("getAllTeams", () => {
  it("returns teams from TxLINE API", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTeams),
    });
    const teams = await getAllTeams();
    expect(teams).toHaveLength(3);
    expect(teams[0].name).toBe("Brazil");
  });

  it("throws ApiError when API returns non-ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("Server error"),
    });
    await expect(getAllTeams()).rejects.toThrow();
  });

  it("throws on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));
    await expect(getAllTeams()).rejects.toThrow();
  });
});

describe("getFixtures", () => {
  it("returns all fixtures from TxLINE", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "f1", homeTeamId: "BRA", awayTeamId: "ARG", homeTeamName: "Brazil", awayTeamName: "Argentina", homeScore: 0, awayScore: 0, status: "scheduled", kickoff: "2026-01-01T00:00:00Z", minute: 0, stage: "group", group: "A" }]),
    });
    const fixtures = await getFixtures();
    expect(fixtures).toHaveLength(1);
  });
});

describe("getLiveFixtures", () => {
  it("returns live fixtures from TxLINE", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    const fixtures = await getLiveFixtures();
    expect(fixtures).toEqual([]);
  });
});

describe("getFixtureEvents", () => {
  it("returns only goal/own_goal/penalty events, filtered", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEvents),
    });
    const events = await getFixtureEvents("f1");
    expect(events).toHaveLength(5); // 3 goals + 1 own_goal + 1 penalty
    for (const evt of events) {
      expect(["goal", "own_goal", "penalty"]).toContain(evt.type);
    }
  });

  it("throws on API failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not found"),
    });
    await expect(getFixtureEvents("nonexistent")).rejects.toThrow();
  });
});

describe("getTeamById", () => {
  it("returns null for nonexistent team", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTeams),
    });
    const team = await getTeamById("ZZZ");
    expect(team).toBeNull();
  });

  it("returns matching team", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTeams),
    });
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
