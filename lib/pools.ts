import { redis } from "./redis";
import { supabaseAdmin } from "./supabase";
import { getAllTeams, getTeamById, getFixtureById } from "./txline";
import { ApiError } from "./errors";
import { logger } from "./logger";
import type { LeaderboardEntry } from "@/types/api";
import type { TxLINETeam } from "@/types/txline";

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;

export type pool_scope = "all" | "single" | "custom";

export interface PoolTeam {
  teamId: string;
  teamName: string;
  flagUrl: string;
  group: string | null;
  fixtureId: string | null;
  opponentName: string | null;
  kickoff: string | null;
}

export interface TeamWithStatus extends PoolTeam {
  isTaken: boolean;
  takenBy: string | null;
}

function secureRandomInt(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export async function generateJoinCode(): Promise<string> {
  let code: string;
  let attempts = 0;

  do {
    const chars: string[] = [];
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
      chars.push(JOIN_CODE_CHARS[secureRandomInt(JOIN_CODE_CHARS.length)]);
    }
    code = chars.join("");
    attempts++;
    if (attempts > 10) {
      throw new ApiError(500, "JOIN_CODE_FAILED", "Failed to generate unique join code");
    }
  } while (await redis.exists(`joincode:${code}`));

  await redis.set(`joincode:${code}`, "1", { ex: 2592000 });
  return code;
}

export async function getPoolAvailableTeams(
  poolId: string,
  scope: pool_scope,
): Promise<PoolTeam[]> {
  if (scope === "all") {
    const teams = await getAllTeams();
    return teams.map((t) => ({
      teamId: t.id,
      teamName: t.name,
      flagUrl: t.flagUrl,
      group: t.group,
      fixtureId: null,
      opponentName: null,
      kickoff: null,
    }));
  }

  const { data: poolFixtures, error } = await supabaseAdmin
    .from("pool_fixtures")
    .select("*")
    .eq("pool_id", poolId);

  if (error) {
    logger.error("Failed to fetch pool_fixtures", { error, poolId });
    throw new ApiError(500, "FIXTURES_FETCH_FAILED", "Failed to fetch pool fixtures");
  }

  if (!poolFixtures || poolFixtures.length === 0) {
    const teams = await getAllTeams();
    return teams.map((t) => ({
      teamId: t.id,
      teamName: t.name,
      flagUrl: t.flagUrl,
      group: t.group,
      fixtureId: null,
      opponentName: null,
      kickoff: null,
    }));
  }

  const seen = new Set<string>();
  const teams: PoolTeam[] = [];

  for (const pf of poolFixtures) {
    for (const side of [
      { teamId: pf.home_team_id, teamName: pf.home_team_name, flagUrl: pf.home_flag_url, opponentName: pf.away_team_name },
      { teamId: pf.away_team_id, teamName: pf.away_team_name, flagUrl: pf.away_flag_url, opponentName: pf.home_team_name },
    ]) {
      if (seen.has(side.teamId)) continue;
      seen.add(side.teamId);

      const team = await getTeamById(side.teamId);
      teams.push({
        teamId: side.teamId,
        teamName: side.teamName,
        flagUrl: side.flagUrl || team?.flagUrl || "",
        group: team?.group || null,
        fixtureId: pf.fixture_id,
        opponentName: side.opponentName,
        kickoff: pf.kickoff,
      });
    }
  }

  return teams;
}

export async function getPoolTakenTeams(
  poolId: string,
): Promise<{ teamId: string; takenBy: string }[]> {
  const { data: members } = await supabaseAdmin
    .from("pool_members")
    .select("team_id, display_name")
    .eq("pool_id", poolId);

  return (members ?? []).map((m) => ({
    teamId: m.team_id,
    takenBy: m.display_name,
  }));
}

export async function getPoolTeamsWithStatus(
  poolId: string,
  scope: pool_scope,
): Promise<TeamWithStatus[]> {
  const available = await getPoolAvailableTeams(poolId, scope);
  const taken = await getPoolTakenTeams(poolId);
  const takenMap = new Map(taken.map((t) => [t.teamId, t.takenBy]));

  return available.map((team) => ({
    ...team,
    isTaken: takenMap.has(team.teamId),
    takenBy: takenMap.get(team.teamId) ?? null,
  }));
}

export async function computeLeaderboard(
  poolId: string,
): Promise<LeaderboardEntry[]> {
  const { data: members, error } = await supabaseAdmin
    .from("pool_members")
    .select("*")
    .eq("pool_id", poolId)
    .order("score", { ascending: false })
    .order("joined_at", { ascending: true });

  if (error || !members) {
    throw new ApiError(500, "LEADERBOARD_ERROR", "Failed to fetch leaderboard");
  }

  const leaderboard: LeaderboardEntry[] = [];
  let currentRank = 0;
  let previousScore: number | null = null;

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (previousScore === null || m.score < previousScore) {
      currentRank = i + 1;
    }
    previousScore = m.score;

    leaderboard.push({
      rank: currentRank,
      memberId: m.id,
      wallet: m.wallet,
      displayName: m.display_name,
      teamId: m.team_id,
      teamName: m.team_name,
      teamFlagUrl: m.team_flag_url,
      teamGroup: m.team_group,
      score: m.score,
      joinedAt: m.joined_at,
    });
  }

  return leaderboard;
}
