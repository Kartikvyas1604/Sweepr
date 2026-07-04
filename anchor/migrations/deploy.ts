import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";

const CLUSTER = process.env.CLUSTER || "devnet";
const PROGRAM_KEYPAIR_PATH = process.env.PROGRAM_KEYPAIR_PATH || path.join(__dirname, "../target/deploy/sweepr-keypair.json");
const MULTISIG_AUTHORITY = process.env.MULTISIG_AUTHORITY || null;

async function main() {
  const clusterUrl = CLUSTER === "devnet"
    ? "https://api.devnet.solana.com"
    : CLUSTER === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "http://127.0.0.1:8899";

  console.log(`Deploying to ${CLUSTER} (${clusterUrl})`);

  const programKeypairBytes = JSON.parse(
    fs.readFileSync(PROGRAM_KEYPAIR_PATH, "utf-8"),
  );
  const programKeypair = Keypair.fromSecretKey(
    new Uint8Array(programKeypairBytes),
  );

  console.log(`Program ID: ${programKeypair.publicKey.toBase58()}`);

  const connection = new anchor.web3.Connection(clusterUrl, "confirmed");
  const wallet = new anchor.Wallet(programKeypair);

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  if (MULTISIG_AUTHORITY) {
    console.log(`\n---`);
    console.log(`IMPORTANT: To set upgrade authority to a multisig:`);
    console.log(`  anchor upgrade target/deploy/sweepr.so --provider.cluster ${clusterUrl}`);
    console.log(`  anchor set-upgrade-authority ${MULTISIG_AUTHORITY} --provider.cluster ${clusterUrl}`);
    console.log(`  (Execute through Squads CLI for the multisig approval.)`);
    console.log(`---\n`);
  } else {
    console.log(`\nDeploying with default authority (deployer keypair).`);
    console.log(`To transfer authority to a Squads multisig later:`);
    console.log(`  anchor set-upgrade-authority <MULTISIG_ADDRESS> --provider.cluster ${clusterUrl}`);
  }

  console.log(`\nTo deploy manually:`);
  console.log(`  anchor deploy --provider.cluster ${clusterUrl}`);
  console.log(`\nVerify on explorer:`);
  console.log(`  https://explorer.solana.com/address/${programKeypair.publicKey.toBase58()}?cluster=${CLUSTER === 'mainnet' ? '' : CLUSTER}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
