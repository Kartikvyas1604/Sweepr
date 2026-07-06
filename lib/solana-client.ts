import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// NOTE: We're using SOL (native) instead of USDC for devnet.
// The Anchor program still needs a USDC mint address for account resolution,
// but since initializePool uses entryFeeUsdc=0, no actual USDC transfer occurs.
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

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// SHA256("global:joinPool") first 8 bytes — Anchor instruction discriminator
const JOIN_POOL_DISCRIMINATOR = new Uint8Array([201, 134, 149, 219, 192, 247, 31, 55]);

function buildJoinPoolInstruction(
  programId: PublicKey,
  poolIdBytes: Uint8Array,
  teamIdBytes: number[],
  memberPubkey: PublicKey,
  poolPda: PublicKey,
  memberPda: PublicKey,
  usdcMint: PublicKey,
): TransactionInstruction {
  // Instruction data = 8-byte discriminator + poolId (16 bytes) + teamId (8 bytes)
  const data = new Uint8Array(8 + 16 + 8);
  data.set(JOIN_POOL_DISCRIMINATOR, 0);
  data.set(poolIdBytes, 8);
  data.set(teamIdBytes, 8 + 16);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: memberPubkey, isSigner: true, isWritable: true },
      { pubkey: poolPda, isSigner: false, isWritable: true },
      { pubkey: memberPda, isSigner: false, isWritable: true },
      // memberUsdcAta (optional — null for SOL-only flow)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      // escrowVault (optional — null for SOL-only flow)
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: usdcMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  });
}

/**
 * Build a transaction that sends SOL to the pool PDA (escrow) AND calls the
 * Anchor program's joinPool instruction (with null USDC accounts, since the
 * pool was initialized with entryFeeUsdc=0 on-chain).
 *
 * The transaction is atomic — if either instruction fails, the whole tx
 * reverts. The user signs once and the wallet opens once.
 */
export async function buildJoinPoolTx(
  poolId: string,
  memberPubkey: PublicKey,
  teamIdBytes: number[],
  programId: PublicKey,
  usdcMint: PublicKey,
  connection: Connection,
  entryFeeSol: number = 0,
): Promise<VersionedTransaction> {
  const enc = (s: string) => new TextEncoder().encode(s);
  const poolIdBytes = uuidToBytes(poolId);

  const [poolPda] = PublicKey.findProgramAddressSync(
    [enc("pool"), poolIdBytes],
    programId,
  );

  const [memberPda] = PublicKey.findProgramAddressSync(
    [
      enc("member"),
      poolIdBytes,
      memberPubkey.toBytes(),
    ],
    programId,
  );

  // 1. SOL transfer — sends entry fee to the pool PDA
  const transferIx = SystemProgram.transfer({
    fromPubkey: memberPubkey,
    toPubkey: poolPda,
    lamports: Math.round(entryFeeSol * LAMPORTS_PER_SOL),
  });

  // 2. joinPool instruction — built manually to avoid Anchor methods
  //    builder issues in the browser (no IDL fetch, no resolver RPC calls)
  const joinPoolIx = buildJoinPoolInstruction(
    programId, poolIdBytes, teamIdBytes,
    memberPubkey, poolPda, memberPda, usdcMint,
  );

  const blockhash = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: memberPubkey,
    recentBlockhash: blockhash.blockhash,
    instructions: [transferIx, joinPoolIx],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
