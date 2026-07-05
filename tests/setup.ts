import { vi } from "vitest";

// Mock env before any module imports
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    UPSTASH_REDIS_REST_URL: "https://test.upstash.redis",
    UPSTASH_REDIS_REST_TOKEN: "test-redis-token",
    TXLINE_API_KEY: "test-api-key",
    TXLINE_BASE_URL: "https://txline.test.com",
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars!!",
    JWT_EXPIRY: 86400,
    SETTLEMENT_KEYPAIR: "3fN7iMou8LUbMg23YyEiwstKQqfJPCFF7XJBMzTB6V3ZxgtdkKWHME5Q8hBz5K68wmwPuJUSdMjmxMt4FHx2Q6K8",
    ORACLE_PUBKEY: "EVmpTnRpuJhdGGyyDuV7gv7AuaK1XMErxcjp4nr4gJqb",
    PROTOCOL_FEE_WALLET: "ProtocolFeeWallet11111111111111111111111111111",
    NEXT_PUBLIC_SOLANA_RPC: "https://api.devnet.solana.com",
    SOLANA_NETWORK: "devnet" as const,
    SWEEPR_PROGRAM_ID: "6bvmJVnmogfwcVTrU9y6MaM9G8vYRQBXeHbiZw5BU2sC",
    INNGEST_EVENT_KEY: "test-event-key",
    INNGEST_SIGNING_KEY: "test-signing-key",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}));

// Mock logger (no-op)
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
