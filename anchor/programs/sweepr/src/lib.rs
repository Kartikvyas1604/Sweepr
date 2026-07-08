use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount, Transfer, transfer},
};

pub mod constants;
pub mod errors;
pub mod state;

use constants::*;
use errors::SweeprError;
use state::*;

declare_id!("6bvmJVnmogfwcVTrU9y6MaM9G8vYRQBXeHbiZw5BU2sC");

#[program]
pub mod sweepr {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        pool_id: [u8; 16],
        entry_fee_usdc: u64,
        max_members: u8,
    ) -> Result<()> {
        require!(
            max_members >= 2 && max_members <= MAX_MEMBERS,
            SweeprError::InvalidMaxMembers
        );

        require!(
            entry_fee_usdc == 0 || entry_fee_usdc >= MIN_ENTRY_FEE,
            SweeprError::InvalidEntryFee
        );

        let pool = &mut ctx.accounts.pool_state;
        let clock = Clock::get()?;

        pool.pool_id = pool_id;
        pool.authority = ctx.accounts.authority.key();
        pool.status = PoolStatus::Waiting;
        pool.entry_fee_usdc = entry_fee_usdc;
        pool.total_staked = 0;
        pool.member_count = 0;
        pool.max_members = max_members;
        pool.winner = None;
        pool.created_at = clock.unix_timestamp;
        pool.settled_at = None;
        pool.bump = ctx.bumps.pool_state;

        Ok(())
    }

    pub fn join_pool(
        ctx: Context<JoinPool>,
        _pool_id: [u8; 16],
        team_id: [u8; 8],
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool_state;

        require!(
            pool.status == PoolStatus::Waiting || pool.status == PoolStatus::Active,
            SweeprError::PoolNotJoinable
        );

        require!(
            (pool.member_count as u8) < pool.max_members,
            SweeprError::PoolFull
        );

        if pool.entry_fee_usdc > 0 {
            let member_ata = ctx.accounts.member_usdc_ata.as_ref()
                .ok_or(SweeprError::InsufficientStake)?;
            let escrow = ctx.accounts.escrow_vault.as_ref()
                .ok_or(SweeprError::InsufficientStake)?;

            require!(
                member_ata.amount >= pool.entry_fee_usdc,
                SweeprError::InsufficientStake
            );

            let transfer_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: member_ata.to_account_info(),
                    to: escrow.to_account_info(),
                    authority: ctx.accounts.member.to_account_info(),
                },
            );

            transfer(transfer_ctx, pool.entry_fee_usdc)?;

            pool.total_staked = pool.total_staked
                .checked_add(pool.entry_fee_usdc)
                .ok_or(SweeprError::ArithmeticOverflow)?;
        }

        let clock = Clock::get()?;
        let member_state = &mut ctx.accounts.member_state;

        member_state.pool = pool.key();
        member_state.wallet = ctx.accounts.member.key();
        member_state.team_id = team_id;
        member_state.score = 0;
        member_state.joined_at = clock.unix_timestamp;
        member_state.has_staked = pool.entry_fee_usdc > 0;
        member_state.bump = ctx.bumps.member_state;

        pool.member_count = pool.member_count
            .checked_add(1)
            .ok_or(SweeprError::ArithmeticOverflow)?;

        if pool.member_count == 1 {
            pool.status = PoolStatus::Active;
        }

        Ok(())
    }

    pub fn update_score(
        ctx: Context<UpdateScore>,
        _pool_id: [u8; 16],
        _wallet: Pubkey,
        points: u32,
        _event_nonce: [u8; 16],
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool_state;

        require!(
            pool.status == PoolStatus::Active,
            SweeprError::PoolNotActive
        );

        let event_account = &ctx.accounts.event_nonce_account;
        if event_account.nonce != [0u8; 16] {
            return Err(SweeprError::EventAlreadyProcessed.into());
        }

        let clock = Clock::get()?;
        let event_account = &mut ctx.accounts.event_nonce_account;
        event_account.nonce = _event_nonce;
        event_account.processed_at = clock.unix_timestamp;
        event_account.bump = ctx.bumps.event_nonce_account;

        let member = &mut ctx.accounts.member_state;
        member.score = member.score
            .checked_add(points)
            .ok_or(SweeprError::ArithmeticOverflow)?;

        Ok(())
    }

    pub fn settle_pool(
        ctx: Context<SettlePool>,
        pool_id: [u8; 16],
        winner_wallet: Pubkey,
    ) -> Result<()> {
        let pool_state_info = ctx.accounts.pool_state.to_account_info();
        let pool = &mut ctx.accounts.pool_state;

        require!(
            pool.status == PoolStatus::Active,
            SweeprError::PoolNotActive
        );

        require!(
            ctx.accounts.winner_member_state.wallet == winner_wallet,
            SweeprError::InvalidWinner
        );

        let entry_fee_usdc = pool.entry_fee_usdc;
        let pool_bump = pool.bump;

        if entry_fee_usdc > 0 {
            let escrow = ctx.accounts.escrow_vault.as_ref()
                .ok_or(SweeprError::EscrowEmpty)?;
            let winner_ata = ctx.accounts.winner_usdc_ata.as_ref()
                .ok_or(SweeprError::EscrowEmpty)?;
            let fee_ata = ctx.accounts.protocol_fee_ata.as_ref()
                .ok_or(SweeprError::EscrowEmpty)?;

            let total = escrow.amount;
            require!(total > 0, SweeprError::EscrowEmpty);

            let fee = total
                .checked_mul(PROTOCOL_FEE_BPS)
                .ok_or(SweeprError::ArithmeticOverflow)?
                .checked_div(10_000)
                .ok_or(SweeprError::ArithmeticOverflow)?;

            let payout = total.checked_sub(fee)
                .ok_or(SweeprError::ArithmeticOverflow)?;

            let seeds = &[
                b"pool",
                pool_id.as_ref(),
                &[pool_bump],
            ];
            let signer_seeds = &[&seeds[..]];

            let fee_transfer_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: escrow.to_account_info(),
                    to: fee_ata.to_account_info(),
                    authority: pool_state_info.clone(),
                },
                signer_seeds,
            );
            transfer(fee_transfer_ctx, fee)?;

            let payout_transfer_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: escrow.to_account_info(),
                    to: winner_ata.to_account_info(),
                    authority: pool_state_info.clone(),
                },
                signer_seeds,
            );
            transfer(payout_transfer_ctx, payout)?;
        }

        // Distribute SOL from pool PDA (used for free pools with SOL entry fees)
        let pool_lamports = pool_state_info.lamports();
        let rent = Rent::get()?;
        let rent_exempt = rent.minimum_balance(PoolState::INIT_SPACE + 8);

        if pool_lamports > rent_exempt {
            let distributable = pool_lamports
                .checked_sub(rent_exempt)
                .ok_or(SweeprError::ArithmeticOverflow)?;

            let fee = distributable
                .checked_mul(PROTOCOL_FEE_BPS)
                .ok_or(SweeprError::ArithmeticOverflow)?
                .checked_div(10_000)
                .ok_or(SweeprError::ArithmeticOverflow)?;

            let payout = distributable
                .checked_sub(fee)
                .ok_or(SweeprError::ArithmeticOverflow)?;

            let seeds = &[
                b"pool",
                pool_id.as_ref(),
                &[pool_bump],
            ];
            let signer_seeds = &[&seeds[..]];

            if fee > 0 {
                let fee_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &pool_state_info.key(),
                    &ctx.accounts.protocol_fee_receiver.key(),
                    fee,
                );
                invoke_signed(
                    &fee_ix,
                    &[
                        pool_state_info.clone(),
                        ctx.accounts.protocol_fee_receiver.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    signer_seeds,
                )?;
            }

            if payout > 0 {
                let payout_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &pool_state_info.key(),
                    &ctx.accounts.winner.key(),
                    payout,
                );
                invoke_signed(
                    &payout_ix,
                    &[
                        pool_state_info.clone(),
                        ctx.accounts.winner.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    signer_seeds,
                )?;
            }
        }

        let clock = Clock::get()?;
        pool.status = PoolStatus::Settled;
        pool.winner = Some(winner_wallet);
        pool.settled_at = Some(clock.unix_timestamp);

        Ok(())
    }

    pub fn close_pool(
        ctx: Context<ClosePool>,
        _pool_id: [u8; 16],
    ) -> Result<()> {
        require!(
            ctx.accounts.pool_state.status == PoolStatus::Settled,
            SweeprError::PoolNotSettled
        );

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(pool_id: [u8; 16], entry_fee_usdc: u64, max_members: u8)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + PoolState::INIT_SPACE,
        seeds = [b"pool", pool_id.as_ref()],
        bump
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = pool_state,
        associated_token::token_program = token_program,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pool_id: [u8; 16], team_id: [u8; 8])]
pub struct JoinPool<'info> {
    #[account(mut)]
    pub member: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool_id.as_ref()],
        bump = pool_state.bump,
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        init,
        payer = member,
        space = 8 + MemberState::INIT_SPACE,
        seeds = [b"member", pool_id.as_ref(), member.key().as_ref()],
        bump
    )]
    pub member_state: Account<'info, MemberState>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = member,
    )]
    pub member_usdc_ata: Option<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = pool_state,
        associated_token::token_program = token_program,
    )]
    pub escrow_vault: Option<Account<'info, TokenAccount>>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pool_id: [u8; 16], wallet: Pubkey, points: u32, event_nonce: [u8; 16])]
pub struct UpdateScore<'info> {
    #[account(
        mut,
        address = ORACLE_PUBKEY @ SweeprError::Unauthorized
    )]
    pub oracle: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool_id.as_ref()],
        bump = pool_state.bump,
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        mut,
        seeds = [b"member", pool_id.as_ref(), wallet.as_ref()],
        bump = member_state.bump,
    )]
    pub member_state: Account<'info, MemberState>,

    #[account(
        init_if_needed,
        payer = oracle,
        space = 8 + EventNonce::INIT_SPACE,
        seeds = [b"event", event_nonce.as_ref()],
        bump
    )]
    pub event_nonce_account: Account<'info, EventNonce>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pool_id: [u8; 16], winner_wallet: Pubkey)]
pub struct SettlePool<'info> {
    #[account(
        address = ORACLE_PUBKEY @ SweeprError::Unauthorized
    )]
    pub oracle: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool_id.as_ref()],
        bump = pool_state.bump,
    )]
    pub pool_state: Account<'info, PoolState>,

    #[account(
        seeds = [b"member", pool_id.as_ref(), winner_wallet.as_ref()],
        bump = winner_member_state.bump,
    )]
    pub winner_member_state: Account<'info, MemberState>,

    /// Winner wallet that receives 97.5% of SOL pot
    #[account(mut)]
    pub winner: SystemAccount<'info>,

    /// Protocol fee wallet that receives 2.5% of SOL pot (set via PROTOCOL_FEE_WALLET env)
    #[account(mut)]
    pub protocol_fee_receiver: SystemAccount<'info>,

    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub winner_usdc_ata: Option<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub escrow_vault: Option<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub protocol_fee_ata: Option<Account<'info, TokenAccount>>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(pool_id: [u8; 16])]
pub struct ClosePool<'info> {
    #[account(
        mut,
        constraint = authority.key() == pool_state.authority @ SweeprError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        close = authority,
        seeds = [b"pool", pool_id.as_ref()],
        bump = pool_state.bump,
    )]
    pub pool_state: Account<'info, PoolState>,

    pub system_program: Program<'info, System>,
}
