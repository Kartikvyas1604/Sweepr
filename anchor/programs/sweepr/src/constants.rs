use anchor_lang::prelude::*;

/// Backend oracle wallet that calls update_score and settle_pool.
/// Must match ORACLE_PUBKEY in .env.
#[constant]
pub const ORACLE_PUBKEY: Pubkey = pubkey!("HFstWQ2TcKGyvqD8Gq97fyHkgvahYteMnrhzq124WCkf");

/// Protocol fee in basis points (250 = 2.5%).
#[constant]
pub const PROTOCOL_FEE_BPS: u64 = 250;

/// Minimum entry fee (1 USDC in micro-units).
#[constant]
pub const MIN_ENTRY_FEE: u64 = 1_000_000;

/// Maximum members per pool.
#[constant]
pub const MAX_MEMBERS: u8 = 32;

/// USDC decimals.
#[constant]
pub const USDC_DECIMALS: u8 = 6;

/// Mainnet USDC mint.
#[constant]
pub const USDC_MAINNET_MINT: Pubkey = pubkey!("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

/// Devnet USDC mint.
#[constant]
pub const USDC_DEVNET_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
