export interface Database {
  public: {
    Tables: {
      pools: {
        Row: PoolRow;
        Insert: PoolInsert;
        Update: PoolUpdate;
        Relationships: [];
      };
      pool_members: {
        Row: PoolMemberRow;
        Insert: PoolMemberInsert;
        Update: PoolMemberUpdate;
        Relationships: [];
      };
      score_events: {
        Row: ScoreEventRow;
        Insert: ScoreEventInsert;
        Update: never;
        Relationships: [];
      };
      processed_nonces: {
        Row: ProcessedNonceRow;
        Insert: ProcessedNonceInsert;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_score: {
        Args: {
          p_member_id: string;
          p_points: number;
        };
        Returns: void;
      };
    };
    Enums: {
      pool_status: "waiting" | "active" | "settled";
      event_type: "goal" | "own_goal" | "penalty";
    };
    CompositeTypes: Record<string, never>;
  };
}

export interface PoolRow {
  id: string;
  name: string;
  created_by: string;
  join_code: string;
  status: "waiting" | "active" | "settled";
  entry_fee_usdc: number;
  total_staked_usdc: number;
  escrow_pda: string | null;
  winner_wallet: string | null;
  settlement_tx: string | null;
  max_members: number;
  created_at: string;
  settled_at: string | null;
}

export interface PoolInsert {
  id?: string;
  name: string;
  created_by: string;
  join_code: string;
  status?: "waiting" | "active" | "settled";
  entry_fee_usdc?: number;
  total_staked_usdc?: number;
  escrow_pda?: string | null;
  winner_wallet?: string | null;
  settlement_tx?: string | null;
  max_members?: number;
  created_at?: string;
  settled_at?: string | null;
}

export interface PoolUpdate {
  name?: string;
  status?: "waiting" | "active" | "settled";
  total_staked_usdc?: number;
  escrow_pda?: string | null;
  winner_wallet?: string | null;
  settlement_tx?: string | null;
  settled_at?: string | null;
}

export interface PoolMemberRow {
  id: string;
  pool_id: string;
  wallet: string;
  display_name: string;
  team_id: string;
  team_name: string;
  team_flag_url: string | null;
  team_group: string | null;
  score: number;
  rank: number | null;
  joined_at: string;
  stake_tx: string | null;
}

export interface PoolMemberInsert {
  id?: string;
  pool_id: string;
  wallet: string;
  display_name: string;
  team_id: string;
  team_name: string;
  team_flag_url?: string | null;
  team_group?: string | null;
  score?: number;
  rank?: number | null;
  joined_at?: string;
  stake_tx?: string | null;
}

export interface PoolMemberUpdate {
  score?: number;
  rank?: number | null;
  stake_tx?: string | null;
}

export interface ScoreEventRow {
  id: string;
  pool_id: string;
  member_id: string;
  fixture_id: string;
  event_type: "goal" | "own_goal" | "penalty";
  minute: number | null;
  player_name: string | null;
  team_id: string;
  points_awarded: number;
  txline_event_id: string;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface ScoreEventInsert {
  id?: string;
  pool_id: string;
  member_id: string;
  fixture_id: string;
  event_type: "goal" | "own_goal" | "penalty";
  minute?: number | null;
  player_name?: string | null;
  team_id: string;
  points_awarded: number;
  txline_event_id: string;
  raw_payload?: Record<string, unknown> | null;
  created_at?: string;
}

export interface ProcessedNonceRow {
  nonce: string;
  pool_id: string;
  created_at: string;
}

export interface ProcessedNonceInsert {
  nonce: string;
  pool_id: string;
  created_at?: string;
}
