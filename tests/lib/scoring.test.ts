import { describe, it, expect } from "vitest";
import { processFixtureEvents, SCORING_RULES } from "@/lib/scoring";
import type { TxLINEEvent, TxLINEFixture } from "@/types/txline";

const POOL_ID = "pool-1";
const TEAM_A = "T1";
const TEAM_B = "T2";

const baseMembers = [
  { teamId: TEAM_A, memberId: "m1", wallet: "wallet1", poolId: POOL_ID },
  { teamId: TEAM_A, memberId: "m2", wallet: "wallet2", poolId: POOL_ID },
  { teamId: TEAM_B, memberId: "m3", wallet: "wallet3", poolId: POOL_ID },
];

function makeEvent(overrides: Partial<TxLINEEvent> = {}): TxLINEEvent {
  return {
    id: "evt_001",
    fixtureId: "f1",
    teamId: TEAM_A,
    type: "goal",
    minute: 10,
    playerName: "Player A",
    detail: null,
    ...overrides,
  };
}

describe("processFixtureEvents", () => {
  it("awards points for goal events to the scoring team's members", () => {
    const events = [makeEvent({ id: "evt_001", type: "goal" })];
    const results = processFixtureEvents(events, baseMembers, new Set());
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.points).toBe(SCORING_RULES.goal);
      expect(r.eventType).toBe("goal");
      expect([TEAM_A]).toContain(r.teamId);
    }
    expect(results.map((r) => r.memberId).sort()).toEqual(["m1", "m2"]);
  });

  it("awards points for penalty events", () => {
    const events = [makeEvent({ id: "evt_002", type: "penalty" })];
    const results = processFixtureEvents(events, baseMembers, new Set());
    expect(results).toHaveLength(2);
    expect(results[0].points).toBe(SCORING_RULES.penalty);
  });

  it("awards own_goal points to the OPPOSITE team's members when fixture is known", () => {
    const fixtures: TxLINEFixture[] = [
      {
        id: "f1",
        homeTeamId: TEAM_A,
        awayTeamId: TEAM_B,
        homeTeamName: "Team A",
        awayTeamName: "Team B",
        homeScore: 0,
        awayScore: 0,
        status: "live",
        kickoff: "2026-01-01T00:00:00Z",
        minute: 30,
        stage: "group",
        group: "A",
      },
    ];
    // own_goal by TEAM_A => benefits TEAM_B
    const events = [makeEvent({ id: "evt_003", type: "own_goal", teamId: TEAM_A })];
    const results = processFixtureEvents(events, baseMembers, new Set(), fixtures);
    expect(results).toHaveLength(1);
    expect(results[0].memberId).toBe("m3");
    expect(results[0].points).toBe(SCORING_RULES.own_goal);
  });

  it("handles own_goal fallback when fixture is unknown", () => {
    const events = [makeEvent({ id: "evt_004", type: "own_goal", teamId: TEAM_A })];
    const results = processFixtureEvents(events, baseMembers, new Set());
    // Without fixture, it pools by poolId and gives to opponents
    expect(results).toHaveLength(1);
    expect(results[0].memberId).toBe("m3");
  });

  it("skips already-processed events by nonce", () => {
    const events = [makeEvent({ id: "evt_001", type: "goal" })];
    const processed = new Set(["evt_001"]);
    const results = processFixtureEvents(events, baseMembers, processed);
    expect(results).toHaveLength(0);
  });

  it("skips non-scoring event types (red_card, yellow_card)", () => {
    const events = [
      makeEvent({ id: "evt_005", type: "red_card" }),
      makeEvent({ id: "evt_006", type: "yellow_card" }),
    ];
    const results = processFixtureEvents(events, baseMembers, new Set());
    expect(results).toHaveLength(0);
  });

  it("handles empty events array", () => {
    const results = processFixtureEvents([], baseMembers, new Set());
    expect(results).toHaveLength(0);
  });

  it("handles empty members array", () => {
    const events = [makeEvent({ id: "evt_001" })];
    const results = processFixtureEvents(events, [], new Set());
    expect(results).toHaveLength(0);
  });

  it("handles members from multiple pools", () => {
    const multiPoolMembers = [
      ...baseMembers,
      { teamId: TEAM_A, memberId: "m4", wallet: "wallet4", poolId: "pool-2" },
    ];
    const events = [makeEvent({ id: "evt_007", type: "goal" })];
    const results = processFixtureEvents(events, multiPoolMembers, new Set());
    expect(results).toHaveLength(3);
    const poolIds = [...new Set(results.map((r) => r.poolId))];
    expect(poolIds).toContain(POOL_ID);
    expect(poolIds).toContain("pool-2");
  });

  it("sets playerName and minute from the event", () => {
    const events = [
      makeEvent({
        id: "evt_008",
        type: "goal",
        minute: 42,
        playerName: "Lionel Messi",
      }),
    ];
    const results = processFixtureEvents(events, baseMembers, new Set());
    expect(results[0].minute).toBe(42);
    expect(results[0].playerName).toBe("Lionel Messi");
  });
});
