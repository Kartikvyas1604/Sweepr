import type { TxLINEEvent } from "@/types/txline";

export const SCORING_RULES = {
  goal: 3,
  penalty: 3,
  own_goal: 1,
} as const;

export interface ScoringResult {
  memberId: string;
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
  poolId: string;
}

export function processFixtureEvents(
  events: TxLINEEvent[],
  poolMembers: PoolMemberLookup[],
  processedNonces: Set<string>,
): ScoringResult[] {
  const results: ScoringResult[] = [];
  const teamToMember = new Map<string, PoolMemberLookup>();
  const teamIds = new Set(poolMembers.map((m) => m.teamId));

  for (const member of poolMembers) {
    teamToMember.set(member.teamId, member);
  }

  for (const event of events) {
    if (processedNonces.has(event.id)) continue;
    if (event.type !== "goal" && event.type !== "own_goal" && event.type !== "penalty") continue;

    let targetTeamId: string | null = null;

    if (event.type === "own_goal") {
      for (const tid of teamIds) {
        if (tid !== event.teamId) {
          targetTeamId = tid;
          break;
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
