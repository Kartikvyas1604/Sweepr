import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  Program,
  AnchorProvider,
  Idl,
  BN,
  utils as anchorUtils,
} from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import crypto from "crypto";
import { env } from "./env";
import { logger } from "./logger";
import { ApiError } from "./errors";
import sweeprIdl from "@/anchor/idl/sweepr.json";

let connection: Connection | null = null;
let oracleKeypair: Keypair | null = null;
let program: Program | null = null;

const USDC_MAINNET_MINT = new PublicKey(
  "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
);
const USDC_DEVNET_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(env.NEXT_PUBLIC_SOLANA_RPC, "confirmed");
  }
  return connection;
}

export function getOracleKeypair(): Keypair {
  if (!oracleKeypair) {
    const decoded = bs58.decode(env.SETTLEMENT_KEYPAIR);
    oracleKeypair = Keypair.fromSecretKey(decoded);
  }
  return oracleKeypair;
}

export function getUsdcMint(): PublicKey {
  return env.SOLANA_NETWORK === "mainnet-beta"
    ? USDC_MAINNET_MINT
    : USDC_DEVNET_MINT;
}

export function getProgram(): Program {
  if (!program) {
    const conn = getConnection();
    const keypair = getOracleKeypair();
    const wallet = {
      publicKey: keypair.publicKey,
      signTransaction: async (tx: any) => {
        if ("version" in tx) {
          tx.sign([keypair]);
        } else {
          tx.sign(keypair);
        }
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        for (const tx of txs) {
          if ("version" in tx) {
            tx.sign([keypair]);
          } else {
            tx.sign(keypair);
          }
        }
        return txs;
      },
    };
    const provider = new AnchorProvider(conn, wallet, {
      commitment: "confirmed",
    });
    program = new Program(sweeprIdl as Idl, provider);
  }
  return program;
}

export function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  return Buffer.from(hex, "hex");
}

export function derivePoolPDA(poolId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), uuidToBytes(poolId)],
    new PublicKey(env.SWEEPR_PROGRAM_ID),
  );
}

export function deriveMemberPDA(
  poolId: string,
  wallet: string,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("member"),
      uuidToBytes(poolId),
      new PublicKey(wallet).toBuffer(),
    ],
    new PublicKey(env.SWEEPR_PROGRAM_ID),
  );
}

// FIX: escrow vault is an ATA of the pool PDA (authority = pool_state), not a separate PDA.
// The Anchor program creates it via associated_token::authority = pool_state.
export function deriveEscrowPDA(poolId: string): [PublicKey, number] {
  const ata = deriveEscrowATA(poolId);
  // Return PublicKey as first element, 0 as bump (ATAs don't have bumps in this context)
  return [ata, 0] as [PublicKey, number];
}

export function deriveEscrowATA(poolId: string): PublicKey {
  const [poolPda] = derivePoolPDA(poolId);
  return anchorUtils.token.associatedAddress({
    mint: getUsdcMint(),
    owner: poolPda,
  });
}

export function deriveEventNoncePDA(
  eventNonce: string,
): [PublicKey, number] {
  // FIX: eventNonce could be an arbitrary string (like TxLINE event ID 'evt_001'), so we must hash it to a 16-byte hex string (32 characters) using MD5 to avoid buffer length/decoding errors.
  const hex = eventNonce.length === 32 && /^[0-9a-fA-F]+$/.test(eventNonce)
    ? eventNonce
    : crypto.createHash("md5").update(eventNonce).digest("hex");
  return PublicKey.findProgramAddressSync(
    [Buffer.from("event"), Buffer.from(hex, "hex")],
    new PublicKey(env.SWEEPR_PROGRAM_ID),
  );
}

export async function getEscrowAta(poolId: string): Promise<PublicKey> {
  return deriveEscrowATA(poolId);
}

async function ensureOracleFunded(): Promise<void> {
  try {
    const conn = getConnection();
    const keypair = getOracleKeypair();
    const balance = await conn.getBalance(keypair.publicKey);
    const minBalance = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL minimum

    if (balance < minBalance) {
      logger.warn("Oracle wallet low balance, requesting airdrop", {
        pubkey: keypair.publicKey.toBase58(),
        balance: balance / LAMPORTS_PER_SOL,
      });

      const sig = await conn.requestAirdrop(
        keypair.publicKey,
        2 * LAMPORTS_PER_SOL,
      );
      await conn.confirmTransaction(sig, "confirmed");

      logger.info("Oracle wallet funded via airdrop", {
        sig,
        newBalance: (await conn.getBalance(keypair.publicKey)) / LAMPORTS_PER_SOL,
      });
    }
  } catch (e) {
    logger.error("Failed to fund oracle wallet", { error: String(e) });
  }
}

export async function callInitializePool(
  poolId: string,
  entryFeeUsdc: number,
  maxMembers: number,
  scope: "all" | "single" | "custom" = "all",
): Promise<string> {
  try {
    const prog = getProgram();
    const [poolPda] = derivePoolPDA(poolId);
    const escrowAta = deriveEscrowATA(poolId);
    const usdcMint = getUsdcMint();
    const oracleKeypair = getOracleKeypair();

    // Ensure oracle wallet has SOL for rent + tx fees
    await ensureOracleFunded();

    const poolIdBytes = Array.from(uuidToBytes(poolId));

    // Check if pool already initialized on-chain
    const existingAccount = await getConnection().getAccountInfo(poolPda);
    if (existingAccount) {
      logger.info("Pool already initialized on-chain, skipping", { poolId });
      return "already_initialized";
    }

    const scopeEnum = scope === "all" ? { all: {} } : scope === "single" ? { single: {} } : { custom: {} };

    // Initialize as free pool on-chain (entryFeeUsdc=0).
    // Entry fee is tracked in the database, not on-chain.
    const sig = await (prog.methods as any)
      .initializePool(
        poolIdBytes,
        new BN(0),
        maxMembers,
        scopeEnum,
      )
      .accounts({
        authority: oracleKeypair.publicKey,
        poolState: poolPda,
        escrowVault: escrowAta,
        usdcMint: usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    logger.info("initializePool succeeded", { poolId, sig });
    return sig;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const logs = (e as any)?.logs;
    logger.error("callInitializePool failed", { poolId, error: msg, logs });
    throw new ApiError(
      500,
      "INIT_POOL_FAILED",
      `Failed to initialize pool on-chain: ${msg}`,
    );
  }
}

export async function callJoinPool(
  poolId: string,
  memberWallet: PublicKey,
  teamId: number[],
): Promise<string> {
  try {
    const prog = getProgram();
    const [poolPda] = derivePoolPDA(poolId);
    const [memberPda] = deriveMemberPDA(poolId, memberWallet.toBase58());
    const usdcMint = getUsdcMint();
    const escrowAta = await getEscrowAta(poolId);

    // NOTE: All pools are on-chain free pools (entryFeeUsdc=0) since we
    // handle entry fees via native SOL transfers. USDC accounts are always null.
    const memberUsdcAta = null;
    const escrowVaultAccount = null;

    const sig = await (prog.methods as any)
      .joinPool(Array.from(uuidToBytes(poolId)), Array.from(teamId))
      .accounts({
        member: memberWallet,
        poolState: poolPda,
        memberState: memberPda,
        memberUsdcAta: memberUsdcAta,
        escrowVault: escrowVaultAccount,
        usdcMint: usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return sig;
  } catch (e) {
    logger.error("callJoinPool failed", {
      poolId,
      memberWallet: memberWallet.toBase58(),
      error: String(e),
    });
    throw new ApiError(
      500,
      "JOIN_POOL_FAILED",
      "Failed to join pool on-chain",
    );
  }
}

export async function callUpdateScore(
  poolId: string,
  memberWallet: string,
  points: number,
  eventNonce: string,
): Promise<string> {
  try {
    const prog = getProgram();
    const [poolPda] = derivePoolPDA(poolId);
    const [memberPda] = deriveMemberPDA(poolId, memberWallet);
    const [eventNoncePda] = deriveEventNoncePDA(eventNonce);

    // FIX: Compute the 16-byte nonce seed once and reuse for both the PDA
    // derivation and the program instruction arg so they always match.
    const nonceHex = eventNonce.length === 32 && /^[0-9a-fA-F]+$/.test(eventNonce)
      ? eventNonce
      : crypto.createHash("md5").update(eventNonce).digest("hex");
    const nonceBytes = Array.from(Buffer.from(nonceHex, "hex"));

    const sig = await (prog.methods as any)
      .updateScore(
        Array.from(uuidToBytes(poolId)),
        new PublicKey(memberWallet),
        points,
        nonceBytes,
      )
      .accounts({
        oracle: getOracleKeypair().publicKey,
        poolState: poolPda,
        memberState: memberPda,
        eventNonceAccount: eventNoncePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return sig;
  } catch (e) {
    logger.error("callUpdateScore failed", {
      poolId,
      memberWallet,
      points,
      eventNonce,
      error: String(e),
    });
    throw new ApiError(
      500,
      "SCORE_UPDATE_FAILED",
      "Failed to update score on-chain",
    );
  }
}

export async function callSettlePool(
  poolId: string,
  winnerWallet: string,
): Promise<string> {
  try {
    const prog = getProgram();
    const [poolPda] = derivePoolPDA(poolId);
    const [memberPda] = deriveMemberPDA(poolId, winnerWallet);
    const escrowAta = await getEscrowAta(poolId);
    const usdcMint = getUsdcMint();
    const feeWallet = new PublicKey(env.PROTOCOL_FEE_WALLET);

    // NOTE: All pools are on-chain free pools — USDC accounts are always null.
    const winnerUsdcAta = null;
    const protocolFeeAta = null;
    const escrowVaultAccount = null;

    const sig = await (prog.methods as any)
      .settlePool(
        Array.from(uuidToBytes(poolId)),
        new PublicKey(winnerWallet),
      )
      .accounts({
        oracle: getOracleKeypair().publicKey,
        poolState: poolPda,
        winnerMemberState: memberPda,
        winner: new PublicKey(winnerWallet),
        protocolFeeReceiver: feeWallet,
        winnerUsdcAta: winnerUsdcAta,
        escrowVault: escrowVaultAccount,
        protocolFeeAta: protocolFeeAta,
        usdcMint: usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return sig;
  } catch (e) {
    logger.error("callSettlePool failed", {
      poolId,
      winnerWallet,
      error: String(e),
    });
    throw new ApiError(
      500,
      "SETTLE_FAILED",
      "Failed to settle pool on-chain",
    );
  }
}

export function getUsdcMintForNetwork(network: string): PublicKey {
  return network === "mainnet-beta" ? USDC_MAINNET_MINT : USDC_DEVNET_MINT;
}

export function derivePoolPDAWithProgramId(poolId: string, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), uuidToBytes(poolId)],
    programId,
  );
}

export function deriveMemberPDAWithProgramId(
  poolId: string,
  wallet: string,
  programId: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("member"),
      uuidToBytes(poolId),
      new PublicKey(wallet).toBuffer(),
    ],
    programId,
  );
}

export function getReadonlyProgram(programId: PublicKey, connection?: Connection): Program {
  const conn = connection ?? new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const throwawayWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => { throw new Error("readonly"); },
    signAllTransactions: async (txs: any[]) => { throw new Error("readonly"); },
  };
  const provider = new AnchorProvider(conn, throwawayWallet, {
    commitment: "confirmed",
  });
  return new Program(sweeprIdl as Idl, provider);
}

export function teamIdToBytes(teamId: string): number[] {
  const buf = Buffer.alloc(8);
  const idBytes = Buffer.from(teamId);
  idBytes.copy(buf, 0, 0, Math.min(idBytes.length, 8));
  return Array.from(buf);
}

export async function buildJoinPoolTx(
  poolId: string,
  memberPubkey: PublicKey,
  teamIdBytes: number[],
  programId: PublicKey,
  usdcMint: PublicKey,
  connection: Connection,
): Promise<VersionedTransaction> {
  const prog = getReadonlyProgram(programId, connection);
  const [poolPda] = derivePoolPDAWithProgramId(poolId, programId);
  const [memberPda] = deriveMemberPDAWithProgramId(poolId, memberPubkey.toBase58(), programId);

  // FIX: escrow vault is an ATA of pool_state, not a separate PDA
  const escrowAta = anchorUtils.token.associatedAddress({
    mint: usdcMint,
    owner: poolPda,
  });

  const pool = await (prog.account as any).poolState.fetch(poolPda);
  const isPaidPool = pool.entryFeeUsdc.toNumber() > 0;

  const accounts: Record<string, any> = {
    member: memberPubkey,
    poolState: poolPda,
    memberState: memberPda,
    memberUsdcAta: null,
    escrowVault: null,
    usdcMint,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };

  if (isPaidPool) {
    const memberUsdcAta = anchorUtils.token.associatedAddress({
      mint: usdcMint,
      owner: memberPubkey,
    });
    accounts.memberUsdcAta = memberUsdcAta;
    accounts.escrowVault = escrowAta;
  }

  const tx = await (prog.methods as any)
    .joinPool(Array.from(uuidToBytes(poolId)), teamIdBytes)
    .accounts(accounts)
    .transaction();

  const blockhash = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: memberPubkey,
    recentBlockhash: blockhash.blockhash,
    instructions: tx.instructions,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

export async function verifyJoinPoolTx(
  txSignature: string,
  expectedPoolId: string,
  expectedMemberWallet: string,
  expectedEntryFeeSol: number = 0,
): Promise<boolean> {
  try {
    const conn = getConnection();
    let tx = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      tx = await conn.getTransaction(txSignature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (tx) break;
      logger.info(`verifyJoinPoolTx: Transaction ${txSignature} not found, retrying attempt ${attempt}...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!tx) return false;

    const [expectedPoolPda] = derivePoolPDA(expectedPoolId);
    const [expectedMemberPda] = deriveMemberPDA(expectedPoolId, expectedMemberWallet);
    const programIdStr = env.SWEEPR_PROGRAM_ID;
    const memberPubkey = new PublicKey(expectedMemberWallet);

    let hasProgramIx = false;
    let solTransferVerified = false;

    for (const ix of tx.transaction.message.compiledInstructions) {
      const accountKeys = tx.transaction.message.staticAccountKeys;
      const progId = accountKeys[ix.programIdIndex].toString();

      // Check for Anchor program joinPool instruction
      if (progId === programIdStr) {
        const ixAccounts = ix.accountKeyIndexes.map(
          (idx: number) => accountKeys[idx].toString(),
        );
        const hasPool = ixAccounts.includes(expectedPoolPda.toString());
        const hasMember = ixAccounts.includes(expectedMemberPda.toString());
        if (hasPool && hasMember) {
          hasProgramIx = true;
        }
      }

      // Check for SOL transfer to pool PDA
      if (progId === SystemProgram.programId.toBase58()) {
        const ixAccounts = ix.accountKeyIndexes.map(
          (idx: number) => accountKeys[idx].toString(),
        );
        // Check if member is sender and poolPDA is receiver
        const fromAddr = ixAccounts[0];
        const toAddr = ixAccounts[1];
        if (fromAddr === memberPubkey.toBase58() && toAddr === expectedPoolPda.toBase58()) {
          solTransferVerified = true;
        }
      }
    }

    // Verify SOL balance change as a second check
    if (expectedEntryFeeSol > 0 && tx.meta) {
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;
      const poolIdx = tx.transaction.message.staticAccountKeys.findIndex(
        (k) => k.toBase58() === expectedPoolPda.toBase58(),
      );
      if (poolIdx >= 0) {
        const diff = postBalances[poolIdx] - preBalances[poolIdx];
        const expectedLamports = Math.round(expectedEntryFeeSol * LAMPORTS_PER_SOL);
        if (diff >= expectedLamports) {
          solTransferVerified = true;
        }
      }
    }

    return hasProgramIx && solTransferVerified;
  } catch (e) {
    logger.error("Join pool tx verification failed", {
      txSignature,
      error: String(e),
    });
    return false;
  }
}

export async function verifySolTransfer(
  txSignature: string,
  expectedFrom: string,
  expectedTo: string,
  expectedLamports: number,
): Promise<boolean> {
  try {
    const conn = getConnection();
    const tx = await conn.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return false;

    const preBalances = tx.meta?.preBalances ?? [];
    const postBalances = tx.meta?.postBalances ?? [];
    const accounts = tx.transaction.message.staticAccountKeys;

    const fromIdx = accounts.findIndex((a) => a.toBase58() === expectedFrom);
    const toIdx = accounts.findIndex((a) => a.toBase58() === expectedTo);

    if (fromIdx < 0 || toIdx < 0) return false;

    const fromDiff = preBalances[fromIdx] - postBalances[fromIdx];
    const toDiff = postBalances[toIdx] - preBalances[toIdx];

    // Allow for tx fees (from account loses more than expected)
    return toDiff >= expectedLamports && fromDiff >= expectedLamports;
  } catch (e) {
    logger.error("SOL transfer verification failed", {
      txSignature,
      error: String(e),
    });
    return false;
  }
}
