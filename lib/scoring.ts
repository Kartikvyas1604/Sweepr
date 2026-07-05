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
  const teamToMembers = new Map<string, PoolMemberLookup[]>();
  const fixtureLookup = new Map<string, TxLINEFixture>();

  // FIX: scoring logic previously mapped teamId to a single member, overwriting entries for other pools using the same team. Map teamId to an array of members instead.
  for (const member of poolMembers) {
    const list = teamToMembers.get(member.teamId) || [];
    list.push(member);
    teamToMembers.set(member.teamId, list);
  }

  if (fixtures) {
    for (const f of fixtures) {
      fixtureLookup.set(f.id, f);
    }
  }

  for (const event of events) {
    if (processedNonces.has(event.id)) continue;
    if (event.type !== "goal" && event.type !== "own_goal" && event.type !== "penalty") continue;

    if (event.type === "own_goal") {
      const fixture = fixtureLookup.get(event.fixtureId);
      if (fixture) {
        // Own goal benefits the OPPOSITE team in the fixture
        const benefitingTeamId =
          event.teamId === fixture.homeTeamId
            ? fixture.awayTeamId
            : fixture.homeTeamId;
        
        const members = teamToMembers.get(benefitingTeamId);
        if (members) {
          const points = SCORING_RULES[event.type];
          for (const member of members) {
            results.push({
              memberId: member.memberId,
              wallet: member.wallet,
              poolId: member.poolId,
              teamId: benefitingTeamId,
              fixtureId: event.fixtureId,
              eventId: event.id,
              eventType: event.type,
              points,
              minute: event.minute,
              playerName: event.playerName,
            });
          }
        }
      } else {
        // FIX: fallback own-goal target team mapping was grabbing the first key that is not event.teamId. Instead, isolate opponent matching by pool.
        const pools = new Map<string, PoolMemberLookup[]>();
        for (const m of poolMembers) {
          const list = pools.get(m.poolId) || [];
          list.push(m);
          pools.set(m.poolId, list);
        }

        for (const [poolId, members] of pools.entries()) {
          const opponents = members.filter((m) => m.teamId !== event.teamId);
          const hasScoringTeam = members.some((m) => m.teamId === event.teamId);
          if (hasScoringTeam) {
            const points = SCORING_RULES[event.type];
            for (const member of opponents) {
              results.push({
                memberId: member.memberId,
                wallet: member.wallet,
                poolId: member.poolId,
                teamId: member.teamId,
                fixtureId: event.fixtureId,
                eventId: event.id,
                eventType: event.type,
                points,
                minute: event.minute,
                playerName: event.playerName,
              });
            }
          }
        }
      }
    } else {
      const members = teamToMembers.get(event.teamId);
      if (members) {
        const points = SCORING_RULES[event.type];
        for (const member of members) {
          results.push({
            memberId: member.memberId,
            wallet: member.wallet,
            poolId: member.poolId,
            teamId: event.teamId,
            fixtureId: event.fixtureId,
            eventId: event.id,
            eventType: event.type,
            points,
            minute: event.minute,
            playerName: event.playerName,
          });
        }
      }
    }
  }

  return results;
}
