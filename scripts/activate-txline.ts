import { Connection, Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import nacl from "tweetnacl";
import fs from "fs";

const DEVNET_RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const TXL_MINT = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
const API_ORIGIN = "https://txline-dev.txodds.com";

async function main() {
  const guestJwt = process.env.TXLINE_GUEST_JWT;
  if (!guestJwt) {
    console.error("Usage: TXLINE_GUEST_JWT=<jwt> npx tsx scripts/activate-txline.ts");
    process.exit(1);
  }

  // Use local keypair (has 5 SOL on devnet)
  const secret = JSON.parse(fs.readFileSync("/Users/0xkartikvyas/.config/solana/id.json", "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(secret));
  console.log("Using:", payer.publicKey.toBase58());

  const connection = new Connection(DEVNET_RPC, "confirmed");

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], PROGRAM_ID);
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], PROGRAM_ID);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(TXL_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const userTokenAccount = getAssociatedTokenAddressSync(TXL_MINT, payer.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  // Build subscribe instruction data
  // discriminator: [254,28,191,138,156,179,183,53] + service_level_id(u16 LE) + weeks(u8)
  const ixData = Buffer.alloc(11);
  ixData.set([254, 28, 191, 138, 156, 179, 183, 53], 0);
  ixData.writeUInt16LE(1, 8); // service_level_id = 1 (free 60s-delay World Cup)
  ixData.writeUInt8(4, 10);  // weeks = 4

  const subscribeIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: pricingMatrixPda, isSigner: false, isWritable: false },
      { pubkey: TXL_MINT, isSigner: false, isWritable: false },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: tokenTreasuryVault, isSigner: false, isWritable: true },
      { pubkey: tokenTreasuryPda, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: ixData,
  });

  // Idempotently create user's TxL ATA first
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey, userTokenAccount, payer.publicKey, TXL_MINT,
    TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [createAtaIx, subscribeIx],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([payer]);

  console.log("Subscribing to free World Cup tier...");
  const txSig = await connection.sendTransaction(tx, { skipPreflight: false, preflightCommitment: "confirmed" });
  await connection.confirmTransaction(txSig);
  console.log("Subscribe tx:", txSig);

  // Sign activation: `${txSig}::${guestJwt}`
  const msgStr = `${txSig}::${guestJwt}`;
  const sigBytes = nacl.sign.detached(new TextEncoder().encode(msgStr), payer.secretKey);
  const walletSignature = Buffer.from(sigBytes).toString("base64");

  console.log("Activating API token...");
  const actRes = await fetch(`${API_ORIGIN}/api/token/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${guestJwt}` },
    body: JSON.stringify({ txSig, walletSignature, leagues: [] }),
  });

  if (!actRes.ok) {
    console.error("Activation failed:", actRes.status, await actRes.text());
    process.exit(1);
  }

  const text = await actRes.text();
  let apiToken: string;
  try {
    apiToken = JSON.parse(text).token ?? JSON.parse(text);
  } catch {
    apiToken = text.trim();
  }
  console.log("\nTXLINE_API_KEY=", apiToken);
}

main().catch((e) => { console.error(e); process.exit(1); });
