import { Connection, PublicKey, Keypair, VersionedTransaction } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { env } from "./env";
import { logger } from "./logger";
import { ApiError } from "./errors";
import type { Sweepr } from "@/anchor/idl/sweepr";

let connection: Connection | null = null;
let oracleKeypair: Keypair | null = null;
let program: Program<Sweepr> | null = null;

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

export function getProgram(): Program<Sweepr> {
  if (!program) {
    const conn = getConnection();
    const wallet = {
      publicKey: getOracleKeypair().publicKey,
      signTransaction: async (tx: any) => {
        tx.sign([getOracleKeypair()]);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        for (const tx of txs) tx.sign([getOracleKeypair()]);
        return txs;
      },
    };
    const provider = new AnchorProvider(conn, wallet, {
      commitment: "confirmed",
    });
    const idl = require("@/anchor/idl/sweepr.json") as Sweepr;
    program = new Program(idl, provider) as unknown as Program<Sweepr>;
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

export function deriveEscrowPDA(poolId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), uuidToBytes(poolId)],
    new PublicKey(env.SWEEPR_PROGRAM_ID),
  );
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

    const fromPubkey = new PublicKey(expectedFrom);
    const toPubkey = new PublicKey(expectedTo);

    for (const ix of tx.transaction.message.compiledInstructions) {
      const accounts = ix.accountKeys.map((idx: number) =>
        tx.transaction.message.staticAccountKeys[idx].toString(),
      );

      if (accounts.includes(fromPubkey.toString()) && accounts.includes(toPubkey.toString())) {
        const postBalances = tx.meta?.postBalances ?? [];
        const preBalances = tx.meta?.preBalances ?? [];
        const fromIndex = tx.transaction.message.staticAccountKeys.findIndex(
          (k: PublicKey) => k.equals(fromPubkey),
        );
        const toIndex = tx.transaction.message.staticAccountKeys.findIndex(
          (k: PublicKey) => k.equals(toPubkey),
        );
        if (fromIndex === -1 || toIndex === -1) continue;

        const solDiff = (postBalances[toIndex] - preBalances[toIndex]);
        if (solDiff === expectedAmount * 1_000_000) {
          return true;
        }
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

    const sig = await prog.methods
      .updateScore(points, eventNonce)
      .accounts({
        pool: poolPda,
        member: memberPda,
        oracle: getOracleKeypair().publicKey,
      } as any)
      .rpc();

    return sig;
  } catch (e) {
    logger.error("callUpdateScore failed", {
      poolId,
      memberWallet,
      points,
      error: String(e),
    });
    throw new ApiError(500, "SCORE_UPDATE_FAILED", "Failed to update score on-chain");
  }
}

export async function callSettlePool(
  poolId: string,
  winnerWallet: string,
): Promise<string> {
  try {
    const prog = getProgram();
    const [poolPda] = derivePoolPDA(poolId);
    const [escrowPda] = deriveEscrowPDA(poolId);

    const sig = await prog.methods
      .settlePool()
      .accounts({
        pool: poolPda,
        escrow: escrowPda,
        winner: new PublicKey(winnerWallet),
        oracle: getOracleKeypair().publicKey,
        protocolFeeWallet: new PublicKey(env.PROTOCOL_FEE_WALLET),
      } as any)
      .rpc();

    return sig;
  } catch (e) {
    logger.error("callSettlePool failed", {
      poolId,
      winnerWallet,
      error: String(e),
    });
    throw new ApiError(500, "SETTLE_FAILED", "Failed to settle pool on-chain");
  }
}
