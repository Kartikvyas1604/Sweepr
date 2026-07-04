use anchor_lang::prelude::*;

/// Backend oracle wallet that calls update_score and settle_pool.
/// Replace with your actual oracle pubkey before mainnet deployment.
#[constant]
pub const ORACLE_PUBKEY: Pubkey = pubkey!("EVmpTnRpuJhdGGyyDuV7gv7AuaK1XMErxcjp4nr4gJqb");

/// Protocol fee wallet that receives 5% of settled pools.
/// Replace with your actual fee wallet before mainnet deployment.
#[constant]
pub const PROTOCOL_FEE_WALLET: Pubkey = pubkey!("Hb17qysxGiG6LPGXNqEYpZKfQH7Fc7XDGkVJvqx4zSLp");

/// Protocol fee in basis points (500 = 5%).
#[constant]
pub const PROTOCOL_FEE_BPS: u64 = 500;

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
