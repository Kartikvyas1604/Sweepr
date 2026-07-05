import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
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
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import bs58 from "bs58";
import crypto from "crypto";
import { env } from "./env";
import { logger } from "./logger";
import { ApiError } from "./errors";

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
        tx.sign([keypair]);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        for (const tx of txs) tx.sign([keypair]);
        return txs;
      },
    };
    const provider = new AnchorProvider(conn, wallet, {
      commitment: "confirmed",
    });
    const idl = require("@/anchor/idl/sweepr.json") as Idl;
    program = new Program(idl, provider);
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

export async function callInitializePool(
  poolId: string,
  entryFeeUsdc: number,
  maxMembers: number,
): Promise<string> {
  try {
    const prog = getProgram();
    const [poolPda] = derivePoolPDA(poolId);
    const escrowAta = deriveEscrowATA(poolId);
    const usdcMint = getUsdcMint();

    const sig = await (prog.methods as any)
      .initializePool(
        Array.from(uuidToBytes(poolId)),
        new BN(entryFeeUsdc),
        maxMembers,
      )
      .accounts({
        authority: getOracleKeypair().publicKey,
        poolState: poolPda,
        escrowVault: escrowAta,
        usdcMint: usdcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return sig;
  } catch (e) {
    logger.error("callInitializePool failed", {
      poolId,
      entryFeeUsdc,
      error: String(e),
    });
    throw new ApiError(
      500,
      "INIT_POOL_FAILED",
      "Failed to initialize pool on-chain",
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

    const pool = await (prog.account as any).poolState.fetch(poolPda);
    const isPaidPool = pool.entryFeeUsdc.toNumber() > 0;

    let memberUsdcAta = null;
    let escrowVaultAccount = null;

    if (isPaidPool) {
      memberUsdcAta = (
        await getOrCreateAssociatedTokenAccount(
          getConnection(),
          getOracleKeypair(),
          usdcMint,
          memberWallet,
        )
      ).address;
      escrowVaultAccount = escrowAta;
    }

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

    const pool = await (prog.account as any).poolState.fetch(poolPda);
    const isPaidPool = pool.entryFeeUsdc.toNumber() > 0;

    let winnerUsdcAta = null;
    let protocolFeeAta = null;
    let escrowVaultAccount = null;

    if (isPaidPool) {
      winnerUsdcAta = (
        await getOrCreateAssociatedTokenAccount(
          getConnection(),
          getOracleKeypair(),
          usdcMint,
          new PublicKey(winnerWallet),
        )
      ).address;

      protocolFeeAta = (
        await getOrCreateAssociatedTokenAccount(
          getConnection(),
          getOracleKeypair(),
          usdcMint,
          new PublicKey(env.PROTOCOL_FEE_WALLET),
        )
      ).address;

      escrowVaultAccount = escrowAta;
    }

    const sig = await (prog.methods as any)
      .settlePool(
        Array.from(uuidToBytes(poolId)),
        new PublicKey(winnerWallet),
      )
      .accounts({
        oracle: getOracleKeypair().publicKey,
        poolState: poolPda,
        winnerMemberState: memberPda,
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
  const idl = require("@/anchor/idl/sweepr.json") as Idl;
  return new Program(idl, provider);
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
): Promise<boolean> {
  try {
    const conn = getConnection();
    const tx = await conn.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx) return false;

    const [expectedPoolPda] = derivePoolPDA(expectedPoolId);
    const [expectedMemberPda] = deriveMemberPDA(expectedPoolId, expectedMemberWallet);

    const programIdStr = env.SWEEPR_PROGRAM_ID;

    for (const ix of tx.transaction.message.compiledInstructions) {
      const accountKeys = tx.transaction.message.staticAccountKeys;
      const progId = accountKeys[ix.programIdIndex].toString();
      if (progId !== programIdStr) continue;

      const ixAccounts = ix.accountKeyIndexes.map(
        (idx: number) => accountKeys[idx].toString(),
      );

      const hasPool = ixAccounts.includes(expectedPoolPda.toString());
      const hasMember = ixAccounts.includes(expectedMemberPda.toString());
      if (hasPool && hasMember) {
        return true;
      }
    }
    return false;
  } catch (e) {
    logger.error("Join pool tx verification failed", {
      txSignature,
      error: String(e),
    });
    return false;
  }
}

export async function verifyUsdcTransfer(
  txSignature: string,
  expectedFrom: string,
  expectedTo: string,
  expectedAmount: number,
): Promise<boolean> {
  try {
    const conn = getConnection();
    const tx = await conn.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return false;

    const preBalances = tx.meta?.preTokenBalances ?? [];
    const postBalances = tx.meta?.postTokenBalances ?? [];

    // FIX: pre/post token balances use accountIndex (position in the tx account list),
    // not wallet addresses. We need to match by accountIndex and check that the
    // token account owner matches expectedFrom/expectedTo.
    for (const pre of preBalances) {
      if (pre.mint !== getUsdcMint().toBase58()) continue;

      const post = postBalances.find(
        (p: any) =>
          p.accountIndex === pre.accountIndex &&
          p.mint === pre.mint,
      );
      if (!post) continue;

      const preAmount = Number(pre.uiTokenAmount.amount);
      const postAmount = Number(post.uiTokenAmount.amount);

      // Token account owner didn't change in a transfer — the token account itself
      // is an ATA owned by the user or escrow. Check that the token account owner
      // is one of our expected addresses.
      const owner = pre.owner;
      if (owner !== expectedFrom && owner !== expectedTo) continue;

      const diff = Math.abs(postAmount - preAmount);
      // The difference must be exactly the entry fee (in micro-units, 6 decimals)
      const expectedMicroUnits = Math.round(expectedAmount * 1_000_000);
      if (diff === expectedMicroUnits) {
        return true;
      }

      // Also check raw amount (if expectedAmount is already in micro-units)
      if (diff === expectedAmount) {
        return true;
      }
    }

    return false;
  } catch (e) {
    logger.error("USDC transfer verification failed", {
      txSignature,
      error: String(e),
    });
    return false;
  }
}
