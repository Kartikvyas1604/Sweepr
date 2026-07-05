import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/redis", () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

vi.mock("@/lib/mock-data", () => ({
  getMockTeams: vi.fn().mockReturnValue([
    { id: "MOCK1", name: "Mock Team 1", shortName: "M1", flagUrl: "https://example.com/m1.png", group: "A", fifaRanking: 1 },
  ]),
}));

import { cacheGet, cacheSet } from "@/lib/redis";
import { getMockTeams } from "@/lib/mock-data";

const mockResponse = (data: any, status = 200) => {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
};

describe("getAllTeams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", undefined);
  });

  it("returns cached teams if available", async () => {
    const cachedTeams = [{ id: "C1", name: "Cached", shortName: "C", flagUrl: "https://example.com/c.png", group: "A", fifaRanking: 5 }];
    (cacheGet as any).mockResolvedValue(cachedTeams);

    const { getAllTeams } = await import("@/lib/txline");
    const teams = await getAllTeams();
    expect(teams).toEqual(cachedTeams);
  });

  it("fetches from API when cache is empty", async () => {
    (cacheGet as any).mockResolvedValue(null);
    const apiTeams = [{ id: "API1", name: "API Team", shortName: "API", flagUrl: "https://example.com/api.png", group: "B", fifaRanking: 3 }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(apiTeams)));

    const { getAllTeams } = await import("@/lib/txline");
    const teams = await getAllTeams();
    expect(teams).toEqual(apiTeams);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/worldcup/teams"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("falls back to mock data when API fails", async () => {
    (cacheGet as any).mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const { getAllTeams } = await import("@/lib/txline");
    const teams = await getAllTeams();
    expect(teams).toEqual(getMockTeams());
    expect(cacheSet).toHaveBeenCalledWith(expect.any(String), teams, 3600);
  });
});

describe("getFixtures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", undefined);
  });

  it("returns cached fixtures when available", async () => {
    const cached = [{ id: "f1", homeTeamId: "A", awayTeamId: "B", homeTeamName: "A", awayTeamName: "B", homeScore: 0, awayScore: 0, status: "scheduled", kickoff: "2026-01-01T00:00:00Z", minute: null, stage: "group", group: "A" }];
    (cacheGet as any).mockResolvedValue(cached);

    const { getFixtures } = await import("@/lib/txline");
    const fixtures = await getFixtures();
    expect(fixtures).toEqual(cached);
  });

  it("fetches and caches fixtures", async () => {
    (cacheGet as any).mockResolvedValue(null);
    const apiFixtures = [{ id: "f2", homeTeamId: "C", awayTeamId: "D", homeTeamName: "C", awayTeamName: "D", homeScore: 1, awayScore: 0, status: "finished", kickoff: "2026-01-02T00:00:00Z", minute: 90, stage: "group", group: "B" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(apiFixtures)));

    const { getFixtures } = await import("@/lib/txline");
    const fixtures = await getFixtures();
    expect(fixtures).toEqual(apiFixtures);
    expect(cacheSet).toHaveBeenCalledWith(expect.any(String), apiFixtures, 300);
  });
});

describe("getFixtureEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", undefined);
  });

  it("filters to only scoring event types", async () => {
    (cacheGet as any).mockResolvedValue(null);
    const apiEvents = [
      { id: "e1", fixtureId: "f1", teamId: "A", type: "goal", minute: 10, playerName: "P1", detail: null },
      { id: "e2", fixtureId: "f1", teamId: "B", type: "yellow_card", minute: 20, playerName: "P2", detail: null },
      { id: "e3", fixtureId: "f1", teamId: "A", type: "penalty", minute: 30, playerName: "P3", detail: null },
      { id: "e4", fixtureId: "f1", teamId: "B", type: "red_card", minute: 40, playerName: "P4", detail: null },
      { id: "e5", fixtureId: "f1", teamId: "A", type: "goal", minute: 50, playerName: "P5", detail: null },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse(apiEvents)));

    const { getFixtureEvents } = await import("@/lib/txline");
    const events = await getFixtureEvents("f1");
    expect(events).toHaveLength(3);
    expect(events.map((e: any) => e.id)).toEqual(["e1", "e3", "e5"]);
  });
});

describe("computePointsForEvent", () => {
  it("returns 3 for goals", async () => {
    const { computePointsForEvent } = await import("@/lib/txline");
    expect(computePointsForEvent({ type: "goal" } as any)).toBe(3);
    expect(computePointsForEvent({ type: "penalty" } as any)).toBe(3);
    expect(computePointsForEvent({ type: "own_goal" } as any)).toBe(1);
    expect(computePointsForEvent({ type: "red_card" } as any)).toBe(0);
  });
});
