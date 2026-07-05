import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import {
  generateNonce,
  storeNonce,
  verifyAndConsumeNonce,
  verifyWalletSignature,
  issueJWT,
  verifyJWT,
  requireAuth,
} from "@/lib/auth";
import { ApiError } from "@/lib/errors";

const MOCK_WALLET = "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr";

vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
  },
}));

import { redis } from "@/lib/redis";

describe("generateNonce", () => {
  it("returns a UUID string", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("generates unique values", () => {
    const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));
    expect(nonces.size).toBe(100);
  });
});

describe("storeNonce / verifyAndConsumeNonce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores nonce with 300s expiry", async () => {
    (redis.set as any).mockResolvedValue("OK");
    await storeNonce(MOCK_WALLET, "test-nonce");
    expect(redis.set).toHaveBeenCalledWith(
      `nonce:${MOCK_WALLET}`,
      "test-nonce",
      { ex: 300 },
    );
  });

  it("returns true when nonce matches and deletes it", async () => {
    (redis.get as any).mockResolvedValue("test-nonce");
    (redis.del as any).mockResolvedValue(1);
    const result = await verifyAndConsumeNonce(MOCK_WALLET, "test-nonce");
    expect(result).toBe(true);
    expect(redis.del).toHaveBeenCalled();
  });

  it("returns false when nonce does not match", async () => {
    (redis.get as any).mockResolvedValue("other-nonce");
    const result = await verifyAndConsumeNonce(MOCK_WALLET, "test-nonce");
    expect(result).toBe(false);
  });

  it("returns false when no nonce stored", async () => {
    (redis.get as any).mockResolvedValue(null);
    const result = await verifyAndConsumeNonce(MOCK_WALLET, "test-nonce");
    expect(result).toBe(false);
  });
});

describe("verifyWalletSignature", () => {
  it("rejects empty signature", async () => {
    const result = await verifyWalletSignature(MOCK_WALLET, "", "nonce-123");
    expect(result).toBe(false);
  });

  it("rejects invalid bs58", async () => {
    const result = await verifyWalletSignature(
      "not-a-valid-base58!!!",
      "also-not-valid!!!",
      "nonce-123",
    );
    expect(result).toBe(false);
  });
});

describe("JWT roundtrip", () => {
  it("issueJWT and verifyJWT roundtrip", async () => {
    const token = await issueJWT(MOCK_WALLET);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
    const payload = await verifyJWT(token);
    expect(payload).not.toBeNull();
    expect(payload!.wallet).toBe(MOCK_WALLET);
  });

  it("verifyJWT returns null for invalid token", async () => {
    const result = await verifyJWT("invalid-token");
    expect(result).toBeNull();
  });

  it("verifyJWT returns null for tampered token", async () => {
    const token = await issueJWT(MOCK_WALLET);
    const parts = token.split(".");
    parts[2] = "tampered";
    const result = await verifyJWT(parts.join("."));
    expect(result).toBeNull();
  });
});

describe("requireAuth", () => {
  it("returns wallet for valid Bearer token", async () => {
    const token = await issueJWT(MOCK_WALLET);
    const request = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await requireAuth(request);
    expect(result.wallet).toBe(MOCK_WALLET);
  });

  it("throws ApiError for missing Authorization header", async () => {
    const request = new Request("http://localhost:3000/api/test");
    await expect(requireAuth(request)).rejects.toThrow(ApiError);
    await expect(requireAuth(request)).rejects.toMatchObject({
      status: 401,
      code: "Unauthorized",
    });
  });

  it("throws ApiError for invalid token", async () => {
    const request = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer invalid" },
    });
    await expect(requireAuth(request)).rejects.toThrow(ApiError);
  });
});
