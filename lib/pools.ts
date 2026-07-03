import { redis } from "./redis";
import { supabaseAdmin } from "./supabase";
import { getAllTeams } from "./txline";
import { ApiError } from "./errors";
import type { LeaderboardEntry } from "@/types/api";

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;

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

export async function assignTeam(poolId: string) {
  const teams = await getAllTeams();

  const { data: existing } = await supabaseAdmin
    .from("pool_members")
    .select("team_id")
    .eq("pool_id", poolId);

  const assignedIds = new Set(existing?.map((m) => m.team_id) ?? []);
  const available = teams.filter((t) => !assignedIds.has(t.id));

  if (available.length === 0) {
    throw new ApiError(409, "NO_TEAMS_LEFT", "All 32 teams have been assigned to this pool");
  }

  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled[0];
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
