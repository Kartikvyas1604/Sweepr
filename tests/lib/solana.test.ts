import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { utils as anchorUtils } from "@coral-xyz/anchor";

// The env mock is provided by tests/setup.ts
import { env } from "@/lib/env";

describe("uuidToBytes", () => {
  it("converts UUID to 16-byte buffer", async () => {
    const { uuidToBytes } = await import("@/lib/solana");
    const buf = uuidToBytes("550e8400-e29b-41d4-a716-446655440000");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(16);
    expect(buf.toString("hex")).toBe("550e8400e29b41d4a716446655440000");
  });
});

describe("teamIdToBytes", () => {
  it("converts short team IDs to 8-byte array", async () => {
    const { teamIdToBytes } = await import("@/lib/solana");
    const bytes = teamIdToBytes("ARG");
    expect(bytes).toHaveLength(8);
    expect(bytes.slice(0, 3)).toEqual([65, 82, 71]); // 'A','R','G' as bytes
    expect(bytes.slice(3)).toEqual([0, 0, 0, 0, 0]); // padded with zeros
  });
});

describe("derivePoolPDA", () => {
  it("derives a deterministic PDA for a pool ID", async () => {
    const { derivePoolPDA } = await import("@/lib/solana");
    const [pda1, bump1] = derivePoolPDA("550e8400-e29b-41d4-a716-446655440000");
    expect(pda1).toBeInstanceOf(PublicKey);
    expect(bump1).toBeGreaterThanOrEqual(0);
    expect(bump1).toBeLessThanOrEqual(255);

    const [pda2] = derivePoolPDA("550e8400-e29b-41d4-a716-446655440000");
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("derives different PDAs for different pool IDs", async () => {
    const { derivePoolPDA } = await import("@/lib/solana");
    const [pda1] = derivePoolPDA("550e8400-e29b-41d4-a716-446655440000");
    const [pda2] = derivePoolPDA("550e8400-e29b-41d4-a716-446655440001");
    expect(pda1.toString()).not.toBe(pda2.toString());
  });
});

describe("deriveMemberPDA", () => {
  it("derives a deterministic PDA for a member", async () => {
    const { deriveMemberPDA } = await import("@/lib/solana");
    const [pda] = deriveMemberPDA(
      "550e8400-e29b-41d4-a716-446655440000",
      "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr",
    );
    expect(pda).toBeInstanceOf(PublicKey);
  });
});

describe("deriveEscrowPDA / deriveEscrowATA", () => {
  it("derives ATA of pool PDA as escrow vault", async () => {
    const { deriveEscrowPDA, deriveEscrowATA, derivePoolPDA, getUsdcMintForNetwork } = await import("@/lib/solana");

    const poolId = "550e8400-e29b-41d4-a716-446655440000";
    const [poolPda] = derivePoolPDA(poolId);

    const escrowAta = deriveEscrowATA(poolId);
    const expectedAta = anchorUtils.token.associatedAddress({
      mint: getUsdcMintForNetwork("devnet"),
      owner: poolPda,
    });
    expect(escrowAta.toString()).toBe(expectedAta.toString());

    const [escrowPda] = deriveEscrowPDA(poolId);
    expect(escrowPda.toString()).toBe(escrowAta.toString());
  });
});

describe("deriveEventNoncePDA", () => {
  it("derives PDA from event ID (MD5 hashed)", async () => {
    const { deriveEventNoncePDA } = await import("@/lib/solana");
    const [pda1] = deriveEventNoncePDA("evt_001");
    const [pda2] = deriveEventNoncePDA("evt_001");
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("uses raw hex string if already valid 32-char hex", async () => {
    const { deriveEventNoncePDA } = await import("@/lib/solana");
    const hex = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const [pda1] = deriveEventNoncePDA(hex);
    const [pda2] = deriveEventNoncePDA(hex);
    expect(pda1.toString()).toBe(pda2.toString());
  });
});
