import type { TxLINEEvent, TxLINEFixture } from "@/types/txline";

export const SCORING_RULES = {
  goal: 3,
  penalty: 3,
  own_goal: 1,
} as const;

export interface ScoringResult {
  memberId: string;
  wallet: string;
  poolId: string;
  teamId: string;
  fixtureId: string;
  eventId: string;
  eventType: "goal" | "own_goal" | "penalty";
  points: number;
  minute: number | null;
  playerName: string | null;
}

interface PoolMemberLookup {
  teamId: string;
  memberId: string;
  wallet: string;
  poolId: string;
}

export function processFixtureEvents(
  events: TxLINEEvent[],
  poolMembers: PoolMemberLookup[],
  processedNonces: Set<string>,
  fixtures?: TxLINEFixture[],
): ScoringResult[] {
  const results: ScoringResult[] = [];
  const teamToMember = new Map<string, PoolMemberLookup>();
  const fixtureLookup = new Map<string, TxLINEFixture>();

  for (const member of poolMembers) {
    teamToMember.set(member.teamId, member);
  }

  if (fixtures) {
    for (const f of fixtures) {
      fixtureLookup.set(f.id, f);
    }
  }

  for (const event of events) {
    if (processedNonces.has(event.id)) continue;
    if (event.type !== "goal" && event.type !== "own_goal" && event.type !== "penalty") continue;

    let targetTeamId: string | null = null;

    if (event.type === "own_goal") {
      const fixture = fixtureLookup.get(event.fixtureId);
      if (fixture) {
        targetTeamId =
          event.teamId === fixture.homeTeamId
            ? fixture.awayTeamId
            : fixture.homeTeamId;
      } else {
        for (const tid of teamToMember.keys()) {
          if (tid !== event.teamId) {
            targetTeamId = tid;
            break;
          }
        }
      }
      if (!targetTeamId) continue;
    } else {
      targetTeamId = event.teamId;
    }

    const member = teamToMember.get(targetTeamId);
    if (!member) continue;

    const points = SCORING_RULES[event.type];
    results.push({
      memberId: member.memberId,
      wallet: member.wallet,
      poolId: member.poolId,
      teamId: targetTeamId,
      fixtureId: event.fixtureId,
      eventId: event.id,
      eventType: event.type,
      points,
      minute: event.minute,
      playerName: event.playerName,
    });
  }

  return results;
}
