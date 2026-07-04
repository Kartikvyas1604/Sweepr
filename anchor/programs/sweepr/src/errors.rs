use anchor_lang::prelude::*;

#[error_code]
pub enum SweeprError {
    #[msg("Pool has reached maximum member capacity")]
    PoolFull,

    #[msg("Wallet has already joined this pool")]
    AlreadyJoined,

    #[msg("Pool is not in a joinable state (must be Waiting or Active)")]
    PoolNotJoinable,

    #[msg("Pool is not currently active")]
    PoolNotActive,

    #[msg("Pool has not been settled yet")]
    PoolNotSettled,

    #[msg("Winner wallet is not a valid member of this pool")]
    InvalidWinner,

    #[msg("Insufficient USDC stake provided")]
    InsufficientStake,

    #[msg("Maximum members must be between 2 and 32")]
    InvalidMaxMembers,

    #[msg("Entry fee must be 0 (free) or at least 1 USDC (1_000_000 micro-units)")]
    InvalidEntryFee,

    #[msg("Signer is not authorized for this action")]
    Unauthorized,

    #[msg("This event has already been processed")]
    EventAlreadyProcessed,

    #[msg("Escrow vault is unexpectedly empty")]
    EscrowEmpty,

    #[msg("Arithmetic operation overflowed")]
    ArithmeticOverflow,
}
