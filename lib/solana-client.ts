import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";

import idl from "@/anchor/idl/sweepr.json";

const USDC_DEVNET_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export function getUsdcMintForNetwork(_network: string): PublicKey {
  return USDC_DEVNET_MINT;
}

export function teamIdToBytes(teamId: string): number[] {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < Math.min(teamId.length, 8); i++) {
    bytes[i] = teamId.charCodeAt(i);
  }
  return Array.from(bytes);
}

function uuidToBytes(uuid: string): number[] {
  const hex = uuid.replace(/-/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < 16; i++) {
    bytes.push(parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  }
  return bytes;
}

function buildReadonlyProgram(programId: PublicKey, connection: Connection): Program {
  const throwawayWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => { throw new Error("readonly"); },
    signAllTransactions: async (txs: any[]) => { throw new Error("readonly"); },
  };
  const provider = new AnchorProvider(connection, throwawayWallet, {
    commitment: "confirmed",
  });
  return new Program(idl as Idl, provider);
}

/**
 * Build a VersionedTransaction containing only the Anchor joinPool instruction
 * (built via Anchor's methods builder to ensure correct discriminator)
 * plus a compute budget instruction.
 */
export async function buildJoinPoolTx(
  poolId: string,
  memberPubkey: PublicKey,
  teamIdBytes: number[],
  programId: PublicKey,
  usdcMint: PublicKey,
  connection: Connection,
  entryFeeSol: number = 0,
): Promise<{ tx: VersionedTransaction; poolPda: PublicKey; memberPda: PublicKey }> {
  const enc = (s: string) => new TextEncoder().encode(s);
  const poolIdBytes = uuidToBytes(poolId);

  const [poolPda] = PublicKey.findProgramAddressSync(
    [enc("pool"), new Uint8Array(poolIdBytes)],
    programId,
  );

  const [memberPda] = PublicKey.findProgramAddressSync(
    [enc("member"), new Uint8Array(poolIdBytes), memberPubkey.toBytes()],
    programId,
  );

  // Pre-flight: verify PoolState exists before building the transaction.
  // (MemberState check intentionally omitted — the server-side join route handles
  //  duplicate detection via DB unique constraint, and a pre-flight check here
  //  would falsely block users whose previous transaction confirmed on-chain but
  //  whose DB insert failed due to a WebSocket timeout.)
  const poolAccount = await connection.getAccountInfo(poolPda);
  if (!poolAccount) {
    throw new Error("Pool is not initialized on-chain yet. Please try again in a moment.");
  }

  // Use Anchor's instruction builder — ensures correct discriminator + serialization
  const prog = buildReadonlyProgram(programId, connection);
  const anchorIx: TransactionInstruction = await (prog.methods as any)
    .joinPool(poolIdBytes, teamIdBytes)
    .accounts({
      member: memberPubkey,
      poolState: poolPda,
      memberState: memberPda,
      memberUsdcAta: null,
      escrowVault: null,
      usdcMint: usdcMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 400_000,
  });

  const instructions: TransactionInstruction[] = [computeBudgetIx];

  if (entryFeeSol > 0) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: memberPubkey,
        toPubkey: poolPda,
        lamports: Math.round(entryFeeSol * 1e9),
      })
    );
  }

  instructions.push(anchorIx);

  const blockhash = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: memberPubkey,
    recentBlockhash: blockhash.blockhash,
    instructions,
  }).compileToV0Message();

  return { tx: new VersionedTransaction(message), poolPda, memberPda };
}

export function deriveMemberPdaClient(poolId: string, memberPubkey: PublicKey, programId: PublicKey): PublicKey {
  const enc = (s: string) => new TextEncoder().encode(s);
  const poolIdBytes = uuidToBytes(poolId);
  const [memberPda] = PublicKey.findProgramAddressSync(
    [enc("member"), new Uint8Array(poolIdBytes), memberPubkey.toBytes()],
    programId,
  );
  return memberPda;
}

export async function diagnoseJoinPool(
  poolId: string,
  memberPubkey: PublicKey,
  teamIdBytes: number[],
  programId: PublicKey,
  connection: Connection,
): Promise<void> {
  const enc = (s: string) => new TextEncoder().encode(s);
  const poolIdBytes = uuidToBytes(poolId);

  const [poolPda] = PublicKey.findProgramAddressSync(
    [enc("pool"), new Uint8Array(poolIdBytes)],
    programId,
  );

  console.log("=== DIAGNOSTIC: Simulating join_pool ===");

  const poolAccountInfo = await connection.getAccountInfo(poolPda);
  console.log("PoolState PDA:", poolPda.toString());
  console.log("PoolState exists:", poolAccountInfo !== null);
  console.log("PoolState owner:", poolAccountInfo?.owner.toString());
  console.log("PoolState data length:", poolAccountInfo?.data.length);

  if (!poolAccountInfo) {
    console.error("DIAGNOSIS: PoolState PDA does NOT exist on-chain!");
    console.error("callInitializePool either failed or was never called.");
    return;
  }

  const [memberPda] = PublicKey.findProgramAddressSync(
    [enc("member"), new Uint8Array(poolIdBytes), memberPubkey.toBytes()],
    programId,
  );
  const memberAccountInfo = await connection.getAccountInfo(memberPda);
  console.log("MemberState PDA:", memberPda.toString());
  console.log("Member already joined:", memberAccountInfo !== null);

  if (memberAccountInfo) {
    console.error("DIAGNOSIS: MemberState already exists — wallet already joined!");
    return;
  }

  // Try Anchor simulation to verify the instruction is valid
  console.log("Attempting Anchor simulation...");
  const prog = buildReadonlyProgram(programId, connection);
  try {
    const simResult = await (prog.methods as any)
      .joinPool(poolIdBytes, teamIdBytes)
      .accounts({
        member: memberPubkey,
        poolState: poolPda,
        memberState: memberPda,
        memberUsdcAta: null,
        escrowVault: null,
        usdcMint: USDC_DEVNET_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .simulate();

    console.log("Anchor simulation SUCCEEDED:", simResult);
    console.log("Logs:", simResult.raw);
  } catch (simError: any) {
    console.error("Anchor simulation FAILED:");
    console.error("Message:", simError.message);
    console.error("Logs:", simError.logs);
  }

  const balance = await connection.getBalance(memberPubkey);
  console.log("User SOL balance:", balance / 1e9);

  const programAccount = await connection.getAccountInfo(programId);
  console.log("Program ID:", programId.toString());
  console.log("Program exists:", programAccount !== null);
  console.log("Program executable:", programAccount?.executable);
  console.log("Program owner:", programAccount?.owner.toString());
}
