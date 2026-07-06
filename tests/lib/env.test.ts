import { describe, it, expect } from "vitest";
import { z } from "zod";

const TEST_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  UPSTASH_REDIS_REST_URL: "https://test.redis",
  UPSTASH_REDIS_REST_TOKEN: "test-token",
  JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars!!",
  NEXT_PUBLIC_SOLANA_RPC: "https://api.devnet.solana.com",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  SWEEPR_PROGRAM_ID: "6bvmJVnmogfwcVTrU9y6MaM9G8vYRQBXeHbiZw5BU2sC",
  SETTLEMENT_KEYPAIR: "3fN7iMou8LUbMg23YyEiwstKQqfJPCFF7XJBMzTB6V3ZxgtdkKWHME5Q8hBz5K68wmwPuJUSdMjmxMt4FHx2Q6K8",
  ORACLE_PUBKEY: "EVmpTnRpuJhdGGyyDuV7gv7AuaK1XMErxcjp4nr4gJqb",
  PROTOCOL_FEE_WALLET: "ProtocolFeeWallet11111111111111111111111111111",
  JWT_EXPIRY: "86400",
  TXLINE_BASE_URL: "https://txline-dev.txodds.com",
  SOLANA_NETWORK: "devnet",
};

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  TXLINE_API_KEY: z.string().optional(),
  TXLINE_BASE_URL: z.string().url().default("https://txline.txodds.com"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.coerce.number().positive().default(86400),
  SETTLEMENT_KEYPAIR: z.string().min(1),
  ORACLE_PUBKEY: z.string().min(1),
  PROTOCOL_FEE_WALLET: z.string().min(1),
  NEXT_PUBLIC_SOLANA_RPC: z.string().url(),
  SOLANA_NETWORK: z.enum(["mainnet-beta", "devnet", "testnet"]).default("mainnet-beta"),
  SWEEPR_PROGRAM_ID: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

describe("env schema validation", () => {
  it("parses successfully when all required vars present", () => {
    const result = schema.safeParse(TEST_ENV);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_SUPABASE_URL).toBe(TEST_ENV.NEXT_PUBLIC_SUPABASE_URL);
    }
  });

  it("uses default JWT_EXPIRY when not set", () => {
    const { JWT_EXPIRY: _, ...without } = TEST_ENV;
    const result = schema.safeParse(without);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.JWT_EXPIRY).toBe(86400);
    }
  });

  it("uses default SOLANA_NETWORK when not set", () => {
    const { SOLANA_NETWORK: _, ...without } = TEST_ENV;
    const result = schema.safeParse(without);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SOLANA_NETWORK).toBe("mainnet-beta");
    }
  });

  it("rejects empty SWEEPR_PROGRAM_ID", () => {
    const result = schema.safeParse({ ...TEST_ENV, SWEEPR_PROGRAM_ID: "" });
    expect(result.success).toBe(false);
  });

  it("accepts missing optional TXLINE_API_KEY", () => {
    const { TXLINE_BASE_URL: _, ...without } = TEST_ENV;
    const result = schema.safeParse(without);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.TXLINE_BASE_URL).toBe("https://txline.txodds.com");
    }
  });

  it("accepts missing optional INNGEST keys", () => {
    const result = schema.safeParse(TEST_ENV);
    expect(result.success).toBe(true);
  });

  it("rejects invalid SOLANA_NETWORK value", () => {
    const result = schema.safeParse({ ...TEST_ENV, SOLANA_NETWORK: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects empty JWT_SECRET (less than 32 chars)", () => {
    const result = schema.safeParse({ ...TEST_ENV, JWT_SECRET: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL for NEXT_PUBLIC_SUPABASE_URL", () => {
    const result = schema.safeParse({ ...TEST_ENV, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" });
    expect(result.success).toBe(false);
  });
});
