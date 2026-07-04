import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
  createMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect, use as chaiUse } from "chai";
import type { Sweepr } from "../target/types/sweepr";

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

function uuidFromBytes(bytes: number[]): string {
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function newPoolId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const ORACLE_KEYPAIR = Keypair.generate();
const PROTOCOL_FEE_WALLET = Keypair.generate();
const USDC_DECIMALS = 6;

describe("sweepr", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Sweepr as Program<Sweepr>;

  let usdcMint: PublicKey;

  before(async () => {
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        provider.wallet.publicKey,
        10 * LAMPORTS_PER_SOL,
      ),
      "confirmed",
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        ORACLE_KEYPAIR.publicKey,
        10 * LAMPORTS_PER_SOL,
      ),
      "confirmed",
    );
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        PROTOCOL_FEE_WALLET.publicKey,
        2 * LAMPORTS_PER_SOL,
      ),
      "confirmed",
    );

    usdcMint = await createMint(
      provider.connection,
      provider.wallet.payer as any,
      provider.wallet.publicKey,
      null,
      USDC_DECIMALS,
    );
  });

  async function createUsdcAccount(
    owner: PublicKey,
    amount: number,
  ): Promise<PublicKey> {
    const ata = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer as any,
      usdcMint,
      owner,
    );
    if (amount > 0) {
      await mintTo(
        provider.connection,
        provider.wallet.payer as any,
        usdcMint,
        ata.address,
        provider.wallet.publicKey,
        amount * 10 ** USDC_DECIMALS,
      );
    }
    return ata.address;
  }

  async function derivePoolPDA(poolId: string): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), uuidToBytes(poolId)],
      program.programId,
    );
  }

  async function deriveMemberPDA(
    poolId: string,
    wallet: PublicKey,
  ): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("member"), uuidToBytes(poolId), wallet.toBuffer()],
      program.programId,
    );
  }

  async function deriveEscrowPDA(poolId: string): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), uuidToBytes(poolId)],
      program.programId,
    );
  }

  async function getEscrowAta(poolId: string): Promise<PublicKey> {
    const [poolPda] = await derivePoolPDA(poolId);
    return anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: poolPda,
    });
  }

  describe("initialize_pool", () => {
    it("creates a free pool (entry_fee = 0)", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(0),
          8,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const pool = await program.account.poolState.fetch(poolPda);
      expect(pool.status).to.eql({ waiting: {} });
      expect(pool.entryFeeUsdc.toNumber()).to.equal(0);
      expect(pool.memberCount).to.equal(0);
      expect(pool.maxMembers).to.equal(8);
      expect(pool.authority.toString()).to.equal(
        provider.wallet.publicKey.toString(),
      );
      expect(pool.winner).to.be.null;
    });

    it("creates a paid pool (entry_fee = 10 USDC)", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(10_000_000),
          16,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const pool = await program.account.poolState.fetch(poolPda);
      expect(pool.status).to.eql({ waiting: {} });
      expect(pool.entryFeeUsdc.toNumber()).to.equal(10_000_000);
      expect(pool.memberCount).to.equal(0);
    });

    it("rejects max_members below 2", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);

      try {
        await program.methods
          .initializePool(
            Array.from(uuidToBytes(poolId)),
            new anchor.BN(0),
            1,
          )
          .accountsStrict({
            authority: provider.wallet.publicKey,
            poolState: poolPda,
            escrowVault: escrowAta,
            usdcMint: usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error.errorMessage).to.include(
          "Maximum members must be between 2 and 32",
        );
      }
    });

    it("rejects entry_fee below minimum", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);

      try {
        await program.methods
          .initializePool(
            Array.from(uuidToBytes(poolId)),
            new anchor.BN(500_000),
            4,
          )
          .accountsStrict({
            authority: provider.wallet.publicKey,
            poolState: poolPda,
            escrowVault: escrowAta,
            usdcMint: usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error.errorMessage).to.include(
          "Entry fee must be 0 (free) or at least 1 USDC",
        );
      }
    });
  });

  describe("join_pool", () => {
    it("joins a free pool", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);
      const member = Keypair.generate();
      const teamId = Buffer.alloc(8);
      teamId.writeBigUInt64BE(BigInt(12345));
      const [memberPda] = await deriveMemberPDA(poolId, member.publicKey);

      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          member.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(0),
          4,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .joinPool(
          Array.from(uuidToBytes(poolId)),
          Array.from(teamId),
        )
        .accountsStrict({
          member: member.publicKey,
          poolState: poolPda,
          memberState: memberPda,
          memberUsdcAta: null,
          escrowVault: null,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([member])
        .rpc();

      const pool = await program.account.poolState.fetch(poolPda);
      expect(pool.memberCount).to.equal(1);
      expect(pool.status).to.eql({ active: {} });

      const memberState = await program.account.memberState.fetch(memberPda);
      expect(memberState.wallet.toString()).to.equal(
        member.publicKey.toString(),
      );
      expect(memberState.hasStaked).to.be.false;
      expect(memberState.score).to.equal(0);
    });

    it("joins a paid pool with USDC transfer", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);
      const member = Keypair.generate();
      const teamId = Buffer.alloc(8);
      teamId.writeBigUInt64BE(BigInt(67890));
      const [memberPda] = await deriveMemberPDA(poolId, member.publicKey);

      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          member.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );

      const memberUsdcAta = await createUsdcAccount(
        member.publicKey,
        100,
      );

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(10_000_000), // 10 USDC
          4,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .joinPool(
          Array.from(uuidToBytes(poolId)),
          Array.from(teamId),
        )
        .accountsStrict({
          member: member.publicKey,
          poolState: poolPda,
          memberState: memberPda,
          memberUsdcAta: memberUsdcAta,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([member])
        .rpc();

      const pool = await program.account.poolState.fetch(poolPda);
      expect(pool.memberCount).to.equal(1);
      expect(pool.totalStaked.toNumber()).to.equal(10_000_000);

      const escrow = await getAccount(provider.connection, escrowAta);
      expect(Number(escrow.amount)).to.equal(10_000_000);

      const memberState = await program.account.memberState.fetch(memberPda);
      expect(memberState.hasStaked).to.be.true;
    });

    it("rejects when pool is full", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(0),
          2,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const member1 = Keypair.generate();
      const member2 = Keypair.generate();
      const member3 = Keypair.generate();

      for (const m of [member1, member2]) {
        await provider.connection.confirmTransaction(
          await provider.connection.requestAirdrop(
            m.publicKey,
            5 * LAMPORTS_PER_SOL,
          ),
        );
        const teamId = Buffer.alloc(8);
        teamId.writeBigUInt64BE(BigInt(Math.floor(Math.random() * 100000)));
        const [mPda] = await deriveMemberPDA(poolId, m.publicKey);
        await program.methods
          .joinPool(Array.from(uuidToBytes(poolId)), Array.from(teamId))
          .accountsStrict({
            member: m.publicKey,
            poolState: poolPda,
            memberState: mPda,
            memberUsdcAta: null,
            escrowVault: null,
            usdcMint: usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([m])
          .rpc();
      }

      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          member3.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );

      const teamId3 = Buffer.alloc(8);
      teamId3.writeBigUInt64BE(BigInt(99999));
      const [mPda3] = await deriveMemberPDA(poolId, member3.publicKey);

      try {
        await program.methods
          .joinPool(Array.from(uuidToBytes(poolId)), Array.from(teamId3))
          .accountsStrict({
            member: member3.publicKey,
            poolState: poolPda,
            memberState: mPda3,
            memberUsdcAta: null,
            escrowVault: null,
            usdcMint: usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([member3])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error.errorMessage).to.include(
          "Pool has reached maximum member capacity",
        );
      }
    });

    it("rejects duplicate join", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);
      const member = Keypair.generate();
      const teamId = Buffer.alloc(8);
      teamId.writeBigUInt64BE(BigInt(11111));
      const [memberPda] = await deriveMemberPDA(poolId, member.publicKey);

      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          member.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(0),
          4,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .joinPool(Array.from(uuidToBytes(poolId)), Array.from(teamId))
        .accountsStrict({
          member: member.publicKey,
          poolState: poolPda,
          memberState: memberPda,
          memberUsdcAta: null,
          escrowVault: null,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([member])
        .rpc();

      try {
        await program.methods
          .joinPool(Array.from(uuidToBytes(poolId)), Array.from(teamId))
          .accountsStrict({
            member: member.publicKey,
            poolState: poolPda,
            memberState: memberPda,
            memberUsdcAta: null,
            escrowVault: null,
            usdcMint: usdcMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([member])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.message).to.include("already in use");
      }
    });
  });

  describe("update_score", () => {
    it("updates score as oracle", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);
      const member = Keypair.generate();
      const teamId = Buffer.alloc(8);
      teamId.writeBigUInt64BE(BigInt(44444));
      const [memberPda] = await deriveMemberPDA(poolId, member.publicKey);

      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          member.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(0),
          4,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .joinPool(Array.from(uuidToBytes(poolId)), Array.from(teamId))
        .accountsStrict({
          member: member.publicKey,
          poolState: poolPda,
          memberState: memberPda,
          memberUsdcAta: null,
          escrowVault: null,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([member])
        .rpc();

      const eventNonce = Buffer.alloc(16);
      eventNonce.writeBigUInt64BE(BigInt(Date.now()), 0);
      eventNonce.writeBigUInt64BE(BigInt(1), 8);

      const [eventPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("event"), eventNonce],
        program.programId,
      );

      await program.methods
        .updateScore(
          Array.from(uuidToBytes(poolId)),
          member.publicKey,
          10,
          Array.from(eventNonce),
        )
        .accountsStrict({
          oracle: ORACLE_KEYPAIR.publicKey,
          poolState: poolPda,
          memberState: memberPda,
          eventNonceAccount: eventPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ORACLE_KEYPAIR])
        .rpc();

      const memberState = await program.account.memberState.fetch(memberPda);
      expect(memberState.score).to.equal(10);
    });

    it("rejects update with invalid oracle", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);
      const member = Keypair.generate();
      const teamId = Buffer.alloc(8);
      teamId.writeBigUInt64BE(BigInt(55555));
      const [memberPda] = await deriveMemberPDA(poolId, member.publicKey);
      const fakeOracle = Keypair.generate();

      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          member.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          fakeOracle.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(0),
          4,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .joinPool(Array.from(uuidToBytes(poolId)), Array.from(teamId))
        .accountsStrict({
          member: member.publicKey,
          poolState: poolPda,
          memberState: memberPda,
          memberUsdcAta: null,
          escrowVault: null,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([member])
        .rpc();

      const eventNonce = Buffer.alloc(16);
      eventNonce.writeBigUInt64BE(BigInt(Date.now()), 0);
      eventNonce.writeBigUInt64BE(BigInt(2), 8);
      const [eventPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("event"), eventNonce],
        program.programId,
      );

      try {
        await program.methods
          .updateScore(
            Array.from(uuidToBytes(poolId)),
            member.publicKey,
            5,
            Array.from(eventNonce),
          )
          .accountsStrict({
            oracle: fakeOracle.publicKey,
            poolState: poolPda,
            memberState: memberPda,
            eventNonceAccount: eventPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([fakeOracle])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error.errorMessage).to.include(
          "Signer is not authorized",
        );
      }
    });

    it("rejects replay of same event nonce", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);
      const member = Keypair.generate();
      const teamId = Buffer.alloc(8);
      teamId.writeBigUInt64BE(BigInt(66666));
      const [memberPda] = await deriveMemberPDA(poolId, member.publicKey);

      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          member.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(0),
          4,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      await program.methods
        .joinPool(Array.from(uuidToBytes(poolId)), Array.from(teamId))
        .accountsStrict({
          member: member.publicKey,
          poolState: poolPda,
          memberState: memberPda,
          memberUsdcAta: null,
          escrowVault: null,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([member])
        .rpc();

      const eventNonce = Buffer.alloc(16);
      eventNonce.writeBigUInt64BE(BigInt(Date.now()), 0);
      eventNonce.writeBigUInt64BE(BigInt(3), 8);
      const [eventPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("event"), eventNonce],
        program.programId,
      );

      await program.methods
        .updateScore(
          Array.from(uuidToBytes(poolId)),
          member.publicKey,
          10,
          Array.from(eventNonce),
        )
        .accountsStrict({
          oracle: ORACLE_KEYPAIR.publicKey,
          poolState: poolPda,
          memberState: memberPda,
          eventNonceAccount: eventPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ORACLE_KEYPAIR])
        .rpc();

      try {
        await program.methods
          .updateScore(
            Array.from(uuidToBytes(poolId)),
            member.publicKey,
            5,
            Array.from(eventNonce),
          )
          .accountsStrict({
            oracle: ORACLE_KEYPAIR.publicKey,
            poolState: poolPda,
            memberState: memberPda,
            eventNonceAccount: eventPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([ORACLE_KEYPAIR])
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error.errorMessage).to.include(
          "This event has already been processed",
        );
      }
    });
  });

  describe("settle_pool", () => {
    it("settles a free pool (no token transfer)", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(0),
          2,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const member = Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          member.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );

      const teamId = Buffer.alloc(8);
      teamId.writeBigUInt64BE(BigInt(77777));
      const [memberPda] = await deriveMemberPDA(poolId, member.publicKey);

      await program.methods
        .joinPool(Array.from(uuidToBytes(poolId)), Array.from(teamId))
        .accountsStrict({
          member: member.publicKey,
          poolState: poolPda,
          memberState: memberPda,
          memberUsdcAta: null,
          escrowVault: null,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([member])
        .rpc();

      await program.methods
        .settlePool(
          Array.from(uuidToBytes(poolId)),
          member.publicKey,
        )
        .accountsStrict({
          oracle: ORACLE_KEYPAIR.publicKey,
          poolState: poolPda,
          winnerMemberState: memberPda,
          winnerUsdcAta: null,
          escrowVault: null,
          protocolFeeAta: null,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ORACLE_KEYPAIR])
        .rpc();

      const pool = await program.account.poolState.fetch(poolPda);
      expect(pool.status).to.eql({ settled: {} });
      expect(pool.winner.toString()).to.equal(member.publicKey.toString());
      expect(pool.settledAt).to.not.be.null;
    });

    it("settles a paid pool with fee and payout", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);
      const entryFee = 5_000_000; // 5 USDC

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(entryFee),
          2,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const member = Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          member.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );

      const memberUsdc = await createUsdcAccount(member.publicKey, 50);
      const teamId = Buffer.alloc(8);
      teamId.writeBigUInt64BE(BigInt(88888));
      const [memberPda] = await deriveMemberPDA(poolId, member.publicKey);

      await program.methods
        .joinPool(Array.from(uuidToBytes(poolId)), Array.from(teamId))
        .accountsStrict({
          member: member.publicKey,
          poolState: poolPda,
          memberState: memberPda,
          memberUsdcAta: memberUsdc,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([member])
        .rpc();

      const protocolUsdc = await createUsdcAccount(
        PROTOCOL_FEE_WALLET.publicKey,
        0,
      );
      const winnerUsdc = await createUsdcAccount(member.publicKey, 0);

      const totalStaked = entryFee; // 1 member x 5 USDC
      const expectedFee = Math.floor((totalStaked * 500) / 10000);
      const expectedPayout = totalStaked - expectedFee;

      await program.methods
        .settlePool(
          Array.from(uuidToBytes(poolId)),
          member.publicKey,
        )
        .accountsStrict({
          oracle: ORACLE_KEYPAIR.publicKey,
          poolState: poolPda,
          winnerMemberState: memberPda,
          winnerUsdcAta: winnerUsdc,
          escrowVault: escrowAta,
          protocolFeeAta: protocolUsdc,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ORACLE_KEYPAIR])
        .rpc();

      const pool = await program.account.poolState.fetch(poolPda);
      expect(pool.status).to.eql({ settled: {} });

      const winnerAtaInfo = await getAccount(provider.connection, winnerUsdc);
      expect(Number(winnerAtaInfo.amount)).to.equal(expectedPayout);

      const feeAtaInfo = await getAccount(provider.connection, protocolUsdc);
      expect(Number(feeAtaInfo.amount)).to.equal(expectedFee);

      const escrowInfo = await getAccount(provider.connection, escrowAta);
      expect(Number(escrowInfo.amount)).to.equal(0);
    });
  });

  describe("close_pool", () => {
    it("closes a settled pool", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(0),
          2,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const member = Keypair.generate();
      await provider.connection.confirmTransaction(
        await provider.connection.requestAirdrop(
          member.publicKey,
          5 * LAMPORTS_PER_SOL,
        ),
      );

      const teamId = Buffer.alloc(8);
      teamId.writeBigUInt64BE(BigInt(11111));
      const [memberPda] = await deriveMemberPDA(poolId, member.publicKey);

      await program.methods
        .joinPool(Array.from(uuidToBytes(poolId)), Array.from(teamId))
        .accountsStrict({
          member: member.publicKey,
          poolState: poolPda,
          memberState: memberPda,
          memberUsdcAta: null,
          escrowVault: null,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([member])
        .rpc();

      await program.methods
        .settlePool(
          Array.from(uuidToBytes(poolId)),
          member.publicKey,
        )
        .accountsStrict({
          oracle: ORACLE_KEYPAIR.publicKey,
          poolState: poolPda,
          winnerMemberState: memberPda,
          winnerUsdcAta: null,
          escrowVault: null,
          protocolFeeAta: null,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([ORACLE_KEYPAIR])
        .rpc();

      await program.methods
        .closePool(Array.from(uuidToBytes(poolId)))
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const poolAccount = await provider.connection.getAccountInfo(poolPda);
      expect(poolAccount).to.be.null;
    });

    it("rejects close before settlement", async () => {
      const poolId = newPoolId();
      const [poolPda] = await derivePoolPDA(poolId);
      const escrowAta = await getEscrowAta(poolId);

      await program.methods
        .initializePool(
          Array.from(uuidToBytes(poolId)),
          new anchor.BN(0),
          2,
        )
        .accountsStrict({
          authority: provider.wallet.publicKey,
          poolState: poolPda,
          escrowVault: escrowAta,
          usdcMint: usdcMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      try {
        await program.methods
          .closePool(Array.from(uuidToBytes(poolId)))
          .accountsStrict({
            authority: provider.wallet.publicKey,
            poolState: poolPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (e: any) {
        expect(e.error.errorMessage).to.include(
          "Pool has not been settled yet",
        );
      }
    });
  });
});
