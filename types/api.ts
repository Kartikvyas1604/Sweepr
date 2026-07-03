import type { TxLINETeam } from "./txline";

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
}

export interface CreatePoolResponse {
  pool: {
    id: string;
    name: string;
    joinCode: string;
    status: string;
    entryFeeUsdc: number;
    maxMembers: number;
    escrowPda: string | null;
    createdAt: string;
  };
  joinUrl: string;
}

export interface JoinPoolRequest {
  displayName: string;
  stakeTxSignature?: string;
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
  assignedTeam: TxLINETeam;
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
