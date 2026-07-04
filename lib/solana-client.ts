import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  Program,
  AnchorProvider,
  Idl,
  utils as anchorUtils,
} from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const USDC_MAINNET_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
const USDC_DEVNET_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export function getUsdcMintForNetwork(network: string): PublicKey {
  return network === "mainnet-beta" ? USDC_MAINNET_MINT : USDC_DEVNET_MINT;
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function getReadonlyProgram(programId: PublicKey, connection: Connection): Program {
  const throwawayWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => { throw new Error("readonly"); },
    signAllTransactions: async (txs: any[]) => { throw new Error("readonly"); },
  };
  const provider = new AnchorProvider(connection, throwawayWallet, {
    commitment: "confirmed",
  });
  const idl = require("@/anchor/idl/sweepr.json") as Idl;
  return new Program(idl, provider);
}

export function teamIdToBytes(teamId: string): number[] {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < Math.min(teamId.length, 8); i++) {
    bytes[i] = teamId.charCodeAt(i);
  }
  return Array.from(bytes);
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

  const enc = (s: string) => new TextEncoder().encode(s);
  const [poolPda] = PublicKey.findProgramAddressSync(
    [enc("pool"), uuidToBytes(poolId)],
    programId,
  );

  const [memberPda] = PublicKey.findProgramAddressSync(
    [
      enc("member"),
      uuidToBytes(poolId),
      memberPubkey.toBytes(),
    ],
    programId,
  );

  const escrowPda = PublicKey.findProgramAddressSync(
    [enc("escrow"), uuidToBytes(poolId)],
    programId,
  )[0];

  const escrowAta = anchorUtils.token.associatedAddress({
    mint: usdcMint,
    owner: escrowPda,
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
