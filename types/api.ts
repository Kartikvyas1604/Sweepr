import type { TxLINETeam } from "./txline";
import type { pool_scope } from "./db";

export interface NonceResponse {
  nonce: string;
  message: string;
}

export interface VerifyResponse {
  token: string;
  wallet: string;
  expiresAt: string;
}

export interface CreatePoolRequest {
  name: string;
  entryFeeUsdc: number;
  maxMembers?: number;
  scope: pool_scope;
  fixtureIds?: string[];
}

export interface CreatePoolResponse {
  pool: {
    id: string;
    name: string;
    joinCode: string;
    status: string;
    entryFeeUsdc: number;
    maxMembers: number;
    scope: pool_scope;
    escrowPda: string | null;
    createdAt: string;
  };
  joinUrl: string;
  availableTeams: { teamId: string; teamName: string; flagUrl: string }[];
  fixtureCount: number;
}

export interface JoinPoolRequest {
  displayName: string;
  teamId: string;
  stakeTxSignature?: string;
  passphrase?: string;
}

export interface JoinPoolResponse {
  member: {
    id: string;
    wallet: string;
    displayName: string;
    teamId: string;
    teamName: string;
    teamFlagUrl: string | null;
    score: number;
    joinedAt: string;
  };
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardEntry {
  rank: number;
  memberId: string;
  wallet: string;
  displayName: string;
  teamId: string;
  teamName: string;
  teamFlagUrl: string | null;
  teamGroup: string | null;
  score: number;
  joinedAt: string;
}

export interface PoolDetailResponse {
  pool: Record<string, unknown>;
  leaderboard: LeaderboardEntry[];
  memberCount: number;
  spotsRemaining: number;
  joinUrl: string;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  recentEvents: ScoreEventFeed[];
  lastUpdated: string;
  poolStatus: string;
}

export interface ScoreEventFeed {
  memberName: string;
  teamName: string;
  teamFlagUrl: string | null;
  eventType: string;
  minute: number | null;
  playerName: string | null;
  pointsAwarded: number;
  createdAt: string;
}

export interface PoolUpdateEvent {
  type: "score_update" | "member_joined" | "pool_settled" | "heartbeat";
  poolId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface TeamsResponse {
  teams: TxLINETeam[];
  assignedTeamIds?: string[];
}

export interface PoolTeamsResponse {
  teams: {
    teamId: string;
    teamName: string;
    flagUrl: string;
    group: string | null;
    isTaken: boolean;
    takenBy: string | null;
    fixture: {
      fixtureId: string;
      opponentName: string;
      kickoff: string;
      stage: string;
    } | null;
  }[];
  scope: pool_scope;
  totalTeams: number;
  takenCount: number;
  availableCount: number;
}

export interface FixturesResponse {
  fixtures: import("./txline").TxLINEFixture[];
}

export interface ScoreSyncResponse {
  poolsProcessed: number;
  eventsProcessed: number;
  newGoals: number;
}

export interface SettleResponse {
  settled: number;
}
