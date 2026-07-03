import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { env } from "./env";
import { logger } from "./logger";
import { ApiError } from "./errors";

let connection: Connection | null = null;
let oracleKeypair: Keypair | null = null;
let program: Program | null = null;

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

    const message = tx.transaction.message;
    const accountKeys = message.staticAccountKeys.map((k: PublicKey) => k.toString());

    for (const ix of message.compiledInstructions) {
      const ixAccounts = ix.accountKeyIndexes.map(
        (idx: number) => accountKeys[idx],
      ) as string[];

      const fromBalance = tx.meta?.preBalances?.[ix.accountKeyIndexes[0] as number] ?? 0;
      const toBalance = tx.meta?.postBalances?.[ix.accountKeyIndexes[1] as number] ?? 0;

      if (
        ixAccounts.includes(fromPubkey.toString()) &&
        ixAccounts.includes(toPubkey.toString())
      ) {
        const solDiff = toBalance - fromBalance;
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

    const sig = await (prog.methods as any)
      .updateScore(points, eventNonce)
      .accounts({
        pool: poolPda,
        member: memberPda,
        oracle: getOracleKeypair().publicKey,
      })
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

    const sig = await (prog.methods as any)
      .settlePool()
      .accounts({
        pool: poolPda,
        escrow: escrowPda,
        winner: new PublicKey(winnerWallet),
        oracle: getOracleKeypair().publicKey,
        protocolFeeWallet: new PublicKey(env.PROTOCOL_FEE_WALLET),
      })
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
