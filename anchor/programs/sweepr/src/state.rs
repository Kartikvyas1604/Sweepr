use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PoolState {
    pub pool_id: [u8; 16],
    pub authority: Pubkey,
    pub status: PoolStatus,
    pub scope: PoolScope,
    pub entry_fee_usdc: u64,
    pub total_staked: u64,
    pub member_count: u8,
    pub max_members: u8,
    pub winner: Option<Pubkey>,
    pub created_at: i64,
    pub settled_at: Option<i64>,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, PartialEq, Eq)]
pub enum PoolStatus {
    Waiting,
    Active,
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, PartialEq, Eq)]
pub enum PoolScope {
    All,
    Single,
    Custom,
}

#[account]
#[derive(InitSpace)]
pub struct MemberState {
    pub pool: Pubkey,
    pub wallet: Pubkey,
    pub team_id: [u8; 8],
    pub score: u32,
    pub joined_at: i64,
    pub has_staked: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct EventNonce {
    pub nonce: [u8; 16],
    pub processed_at: i64,
    pub bump: u8,
}
