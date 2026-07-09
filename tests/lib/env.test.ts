import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

vi.unmock("@/lib/env");

const OLD_ENV = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...OLD_ENV };
});

afterAll(() => {
  process.env = OLD_ENV;
});

function minimalValidEnv(): Record<string, string> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "https://abc123.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    UPSTASH_REDIS_REST_URL: "https://us1-abc123.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-redis-token",
    TXLINE_API_KEY: "test-api-key",
    JWT_SECRET: "a".repeat(32),
    SETTLEMENT_KEYPAIR: "a".repeat(32),
    ORACLE_PUBKEY: "EVmpTnRpuJhdGGyyDuV7gv7AuaK1XMErxcjp4nr4gJqb",
    PROTOCOL_FEE_WALLET: "Hb17qysxGiG6LPGXNqEYpZKfQH7Fc7XDGkVJvqx4zSLp",
    NEXT_PUBLIC_SOLANA_RPC: "https://api.devnet.solana.com",
    SOLANA_NETWORK: "devnet",
    SWEEPR_PROGRAM_ID: "6bvmJVnmogfwcVTrU9y6MaM9G8vYRQBXeHbiZw5BU2sC",
    INNGEST_EVENT_KEY: "test-event-key",
    INNGEST_SIGNING_KEY: "test-signing-key",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  };
}

describe("env validation", () => {
  let importCount = 0;
  async function importEnv(): Promise<any> {
    importCount++;
    return import(`@/lib/env?t=${importCount}`);
  }

  it("parses successfully with minimum valid env vars", async () => {
    process.env = { ...OLD_ENV, ...minimalValidEnv() };
    await expect(importEnv()).resolves.toBeDefined();
  });

  it("rejects invalid SOLANA_NETWORK", async () => {
    process.env = { ...OLD_ENV, ...minimalValidEnv(), SOLANA_NETWORK: "mainnet" };
    await expect(importEnv()).rejects.toThrow();
  });

  it("accepts mainnet-beta as valid network", async () => {
    process.env = {
      ...OLD_ENV,
      ...minimalValidEnv(),
      SOLANA_NETWORK: "mainnet-beta",
      NEXT_PUBLIC_SOLANA_RPC: "https://api.mainnet-beta.solana.com",
    };
    const { env } = await importEnv();
    expect(env.SOLANA_NETWORK).toBe("mainnet-beta");
  });

  it("accepts testnet as valid network", async () => {
    process.env = {
      ...OLD_ENV,
      ...minimalValidEnv(),
      SOLANA_NETWORK: "testnet",
      NEXT_PUBLIC_SOLANA_RPC: "https://api.testnet.solana.com",
    };
    const { env } = await importEnv();
    expect(env.SOLANA_NETWORK).toBe("testnet");
  });

  it("rejects missing TXLINE_API_KEY", async () => {
    process.env = { ...OLD_ENV, ...minimalValidEnv(), NODE_ENV: "production" };
    delete (process.env as any).TXLINE_API_KEY;
    await expect(importEnv()).rejects.toThrow();
  });

  it("rejects short JWT_SECRET (less than 32 chars)", async () => {
    process.env = { ...OLD_ENV, ...minimalValidEnv(), JWT_SECRET: "short" };
    await expect(importEnv()).rejects.toThrow();
  });

  it("rejects invalid NEXT_PUBLIC_SUPABASE_URL", async () => {
    process.env = {
      ...OLD_ENV,
      ...minimalValidEnv(),
      NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
    };
    await expect(importEnv()).rejects.toThrow();
  });

  it("defaults SOLANA_NETWORK to mainnet-beta when not set", async () => {
    process.env = { ...OLD_ENV, ...minimalValidEnv() };
    delete (process.env as any).SOLANA_NETWORK;
    const { env: parsed } = await importEnv();
    expect(parsed.SOLANA_NETWORK).toBe("mainnet-beta");
  });

  it("defaults JWT_EXPIRY to 86400 when not set", async () => {
    process.env = { ...OLD_ENV, ...minimalValidEnv() };
    delete (process.env as any).JWT_EXPIRY;
    const { env: parsed } = await importEnv();
    expect(parsed.JWT_EXPIRY).toBe(86400);
  });

  it("rejects empty UPSTASH_REDIS_REST_URL", async () => {
    process.env = {
      ...OLD_ENV,
      ...minimalValidEnv(),
      UPSTASH_REDIS_REST_URL: "",
    };
    await expect(importEnv()).rejects.toThrow();
  });

  it("rejects missing ORACLE_PUBKEY", async () => {
    process.env = { ...OLD_ENV, ...minimalValidEnv() };
    delete (process.env as any).ORACLE_PUBKEY;
    await expect(importEnv()).rejects.toThrow();
  });

  it("rejects missing PROTOCOL_FEE_WALLET", async () => {
    process.env = { ...OLD_ENV, ...minimalValidEnv() };
    delete (process.env as any).PROTOCOL_FEE_WALLET;
    await expect(importEnv()).rejects.toThrow();
  });

  it("defaults NODE_ENV to production when not set", async () => {
    process.env = { ...OLD_ENV, ...minimalValidEnv() };
    delete (process.env as any).NODE_ENV;
    const { env: parsed } = await importEnv();
    expect(parsed.NODE_ENV).toBe("production");
  });
});
