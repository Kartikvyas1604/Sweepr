import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  getConnection,
  getReadonlyProgram,
  getProgram,
  getOracleKeypair,
  derivePoolPDA,
  deriveMemberPDA,
  deriveEscrowATA,
  deriveEventNoncePDA,
  uuidToBytes,
  getUsdcMint,
  teamIdToBytes,
  verifyJoinPoolTx,
  verifySolTransfer,
} from "@/lib/solana";

vi.mock("@/anchor/idl/sweepr.json", () => ({
  default: {
    address: "6bvmJVnmogfwcVTrU9y6MaM9G8vYRQBXeHbiZw5BU2sC",
    metadata: { name: "sweepr", version: "0.1.0" },
    instructions: [],
    accounts: [],
    errors: [],
    types: [],
  },
}));

vi.mock("@/lib/cors", () => ({
  corsHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "test",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    SOLANA_NETWORK: "devnet",
    NEXT_PUBLIC_SOLANA_RPC: "https://api.devnet.solana.com",
    SETTLEMENT_KEYPAIR: "3yNrz1x6gchZ2FttYLNRQupdkgnQPKqMA6oa9qHZfZgmQA2kbYyfswFpixUCK6cRZDCD6akToyMvGZ4BCE8LimNV",
    SWEEPR_PROGRAM_ID: "6bvmJVnmogfwcVTrU9y6MaM9G8vYRQBXeHbiZw5BU2sC",
  },
}));

describe("getConnection", () => {
  it("returns a Connection object pointing to the configured RPC", () => {
    const conn = getConnection();
    expect(conn).toBeDefined();
    expect(conn.rpcEndpoint).toBe("https://api.devnet.solana.com");
  });
});

describe("getUsdcMint", () => {
  it("returns devnet USDC mint for devnet", () => {
    const mint = getUsdcMint();
    expect(mint.toBase58()).toBe("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
  });
});

describe("uuidToBytes", () => {
  it("converts UUID to 16-byte buffer", () => {
    const buf = uuidToBytes("550e8400-e29b-41d4-a716-446655440000");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(16);
  });
});

describe("derivePoolPDA", () => {
  it("returns a valid PDA", () => {
    const [pda, bump] = derivePoolPDA("550e8400-e29b-41d4-a716-446655440000");
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it("returns different PDAs for different pool IDs", () => {
    const [pda1] = derivePoolPDA("550e8400-e29b-41d4-a716-446655440000");
    const [pda2] = derivePoolPDA("660e8400-e29b-41d4-a716-446655440001");
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });
});

describe("deriveMemberPDA", () => {
  it("returns a valid PDA", () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    const [pda, bump] = deriveMemberPDA("550e8400-e29b-41d4-a716-446655440000", wallet);
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
  });
});

describe("deriveEscrowATA", () => {
  it("returns an ATA public key", () => {
    const ata = deriveEscrowATA("550e8400-e29b-41d4-a716-446655440000");
    expect(ata).toBeInstanceOf(PublicKey);
  });
});

describe("deriveEventNoncePDA", () => {
  it("returns a valid PDA for a nonce", () => {
    const [pda, bump] = deriveEventNoncePDA("event-nonce-123");
    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
  });

  it("accepts a hex string directly", () => {
    const [pda] = deriveEventNoncePDA("0123456789abcdef0123456789abcdef");
    expect(pda).toBeInstanceOf(PublicKey);
  });
});

describe("teamIdToBytes", () => {
  it("returns an array of 8 bytes for a 3-char team ID", () => {
    const bytes = teamIdToBytes("BRA");
    expect(bytes).toHaveLength(8);
    expect(bytes[0]).toBe("B".charCodeAt(0));
    expect(bytes[1]).toBe("R".charCodeAt(0));
    expect(bytes[2]).toBe("A".charCodeAt(0));
  });
});

describe("getReadonlyProgram", () => {
  it("returns a Program object", () => {
    const program = getReadonlyProgram(PublicKey.default);
    expect(program).toBeDefined();
  });
});

describe("getOracleKeypair", () => {
  it("returns a Keypair from SETTLEMENT_KEYPAIR", () => {
    const oracle = getOracleKeypair();
    expect(oracle).toBeInstanceOf(Keypair);
  });
});

describe("getProgram", () => {
  it("creates a Program with oracle keypair", () => {
    const program = getProgram();
    expect(program).toBeDefined();
  });
});

describe("verifyJoinPoolTx", () => {
  it("returns false for a nonexistent transaction", async () => {
    vi.spyOn(getConnection(), "getTransaction").mockResolvedValue(null);
    const result = await verifyJoinPoolTx(
      "nonexistent-sig",
      "pool-1",
      Keypair.generate().publicKey.toBase58(),
      0,
    );
    expect(result).toBe(false);
  }, 30000);
});

describe("verifySolTransfer", () => {
  it("returns false for a nonexistent transaction", async () => {
    vi.spyOn(getConnection(), "getTransaction").mockResolvedValue(null);
    const result = await verifySolTransfer(
      "nonexistent-sig",
      Keypair.generate().publicKey.toBase58(),
      Keypair.generate().publicKey.toBase58(),
      1000,
    );
    expect(result).toBe(false);
  }, 30000);
});
