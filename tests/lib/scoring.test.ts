import { describe, it, expect } from "vitest";
import { processFixtureEvents, SCORING_RULES } from "@/lib/scoring";
import type { TxLINEEvent, TxLINEFixture } from "@/types/txline";

const POOL_A = "pool-a";
const POOL_B = "pool-b";
const TEAM_A = "T1";
const TEAM_B = "T2";
const TEAM_C = "T3";

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

function makeFixture(overrides: Partial<TxLINEFixture> = {}): TxLINEFixture {
  return {
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
    ...overrides,
  };
}

function makeMember(overrides: Partial<{
  teamId: string;
  memberId: string;
  wallet: string;
  poolId: string;
}> = {}) {
  return {
    teamId: TEAM_A,
    memberId: "m1",
    wallet: "wallet1",
    poolId: POOL_A,
    ...overrides,
  };
}

describe("Goal scoring", () => {
  it("awards 3 points for a regular goal to the correct member", () => {
    const events = [makeEvent({ id: "evt_001", type: "goal", teamId: TEAM_A })];
    const members = [
      makeMember({ teamId: TEAM_A, memberId: "m1", wallet: "w1" }),
    ];
    const results = processFixtureEvents(events, members, new Set());
    expect(results).toHaveLength(1);
    expect(results[0].memberId).toBe("m1");
    expect(results[0].points).toBe(3);
    expect(results[0].eventType).toBe("goal");
  });

  it("awards 3 points for a penalty goal", () => {
    const events = [makeEvent({ id: "evt_002", type: "penalty", teamId: TEAM_A })];
    const members = [
      makeMember({ teamId: TEAM_A, memberId: "m1" }),
    ];
    const results = processFixtureEvents(events, members, new Set());
    expect(results).toHaveLength(1);
    expect(results[0].points).toBe(3);
    expect(results[0].eventType).toBe("penalty");
  });

  it("awards 1 point for an own_goal to the BENEFITING team, not the scoring team", () => {
    const fixtures = [makeFixture({ id: "f1", homeTeamId: TEAM_A, awayTeamId: TEAM_B })];
    const events = [makeEvent({ id: "evt_003", type: "own_goal", teamId: TEAM_A })];
    const members = [
      makeMember({ teamId: TEAM_A, memberId: "m_scorer" }),
      makeMember({ teamId: TEAM_B, memberId: "m_beneficiary" }),
    ];
    const results = processFixtureEvents(events, members, new Set(), fixtures);
    expect(results).toHaveLength(1);
    expect(results[0].memberId).toBe("m_beneficiary");
    expect(results[0].points).toBe(1);
  });

  it("awards 0 points for red_card events", () => {
    const events = [makeEvent({ id: "evt_004", type: "red_card" })];
    const members = [makeMember({ teamId: TEAM_A, memberId: "m1" })];
    const results = processFixtureEvents(events, members, new Set());
    expect(results).toHaveLength(0);
  });

  it("awards 0 points for yellow_card events", () => {
    const events = [makeEvent({ id: "evt_005", type: "yellow_card" })];
    const members = [makeMember({ teamId: TEAM_A, memberId: "m1" })];
    const results = processFixtureEvents(events, members, new Set());
    expect(results).toHaveLength(0);
  });
});

describe("Idempotency", () => {
  it("skips events whose IDs are in processedNonces set", () => {
    const events = [makeEvent({ id: "evt_001", type: "goal" })];
    const members = [makeMember({ teamId: TEAM_A, memberId: "m1" })];
    const processed = new Set(["evt_001"]);
    const results = processFixtureEvents(events, members, processed);
    expect(results).toHaveLength(0);
  });

  it("does not skip events with new IDs", () => {
    const events = [makeEvent({ id: "evt_new", type: "goal" })];
    const members = [makeMember({ teamId: TEAM_A, memberId: "m1" })];
    const processed = new Set(["evt_001", "evt_002"]);
    const results = processFixtureEvents(events, members, processed);
    expect(results).toHaveLength(1);
  });

  it("processes same fixture twice safely — second pass adds 0 points", () => {
    const events = [makeEvent({ id: "evt_001", type: "goal" })];
    const members = [makeMember({ teamId: TEAM_A, memberId: "m1" })];
    const processed = new Set<string>();
    const pass1 = processFixtureEvents(events, members, processed);
    expect(pass1).toHaveLength(1);
    processed.add("evt_001");
    const pass2 = processFixtureEvents(events, members, processed);
    expect(pass2).toHaveLength(0);
  });
});

describe("Multi-pool isolation", () => {
  it("only assigns points to members in the correct pool", () => {
    const events = [makeEvent({ id: "evt_001", type: "goal", teamId: TEAM_A })];
    const members = [
      makeMember({ teamId: TEAM_A, memberId: "m_a", poolId: POOL_A }),
      makeMember({ teamId: TEAM_A, memberId: "m_b", poolId: POOL_B }),
    ];
    const results = processFixtureEvents(events, members, new Set());
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.poolId).sort()).toEqual([POOL_A, POOL_B]);
  });

  it("handles same team appearing in two different pools independently", () => {
    const events = [makeEvent({ id: "evt_001", type: "goal", teamId: TEAM_A })];
    const members = [
      makeMember({ teamId: TEAM_A, memberId: "m1", poolId: POOL_A }),
      makeMember({ teamId: TEAM_A, memberId: "m2", poolId: POOL_B }),
    ];
    const results = processFixtureEvents(events, members, new Set());
    expect(results.map((r) => r.memberId).sort()).toEqual(["m1", "m2"]);
    expect(results[0].poolId).not.toBe(results[1].poolId);
  });
});

describe("Edge cases", () => {
  it("handles empty events array without throwing", () => {
    const results = processFixtureEvents([], [makeMember()], new Set());
    expect(results).toHaveLength(0);
  });

  it("handles fixture with no members assigned to either team", () => {
    const events = [makeEvent({ id: "evt_001", type: "goal", teamId: TEAM_C })];
    const members = [makeMember({ teamId: TEAM_A, memberId: "m1" })];
    const results = processFixtureEvents(events, members, new Set());
    expect(results).toHaveLength(0);
  });

  it("handles own_goal when no member is assigned to benefiting team", () => {
    const fixtures = [makeFixture({ id: "f1", homeTeamId: TEAM_A, awayTeamId: TEAM_B })];
    const events = [makeEvent({ id: "evt_001", type: "own_goal", teamId: TEAM_A })];
    const members = [makeMember({ teamId: TEAM_A, memberId: "m1" })]; // no one on TEAM_B
    const results = processFixtureEvents(events, members, new Set(), fixtures);
    expect(results).toHaveLength(0);
  });

  it("handles pool with only 2 members", () => {
    const events = [makeEvent({ id: "evt_001", type: "goal", teamId: TEAM_A })];
    const members = [
      makeMember({ teamId: TEAM_A, memberId: "m1" }),
      makeMember({ teamId: TEAM_B, memberId: "m2" }),
    ];
    const results = processFixtureEvents(events, members, new Set());
    expect(results).toHaveLength(1);
    expect(results[0].memberId).toBe("m1");
  });

  it("handles own_goal fallback when fixture is unknown", () => {
    const events = [makeEvent({ id: "evt_001", type: "own_goal", teamId: TEAM_A })];
    const members = [
      makeMember({ teamId: TEAM_A, memberId: "m_scorer" }),
      makeMember({ teamId: TEAM_B, memberId: "m_beneficiary" }),
    ];
    const results = processFixtureEvents(events, members, new Set());
    expect(results).toHaveLength(1);
    expect(results[0].memberId).toBe("m_beneficiary");
  });

  it("carries playerName and minute through to results", () => {
    const events = [makeEvent({ id: "evt_001", type: "goal", minute: 42, playerName: "Messi" })];
    const members = [makeMember({ teamId: TEAM_A, memberId: "m1" })];
    const results = processFixtureEvents(events, members, new Set());
    expect(results[0].minute).toBe(42);
    expect(results[0].playerName).toBe("Messi");
  });
});
