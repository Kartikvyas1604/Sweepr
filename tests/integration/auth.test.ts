import { describe, it, expect, vi, beforeEach } from "vitest";

const redisStore = new Map<string, string>();
vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn((key: string, value: string, opts?: any) => {
      redisStore.set(key, value);
      return Promise.resolve("OK");
    }),
    get: vi.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
    del: vi.fn((key: string) => Promise.resolve(redisStore.delete(key) ? 1 : 0)),
    exists: vi.fn((key: string) => Promise.resolve(redisStore.has(key) ? 1 : 0)),
  },
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  publishPoolUpdate: vi.fn(),
}));

// Mock verifyWalletSignature to return true for testing
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    verifyWalletSignature: vi.fn().mockResolvedValue(true),
    requireAuth: vi.fn().mockResolvedValue({ wallet: "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr" }),
  };
});

describe("auth flow", () => {
  beforeEach(() => {
    redisStore.clear();
    vi.clearAllMocks();
  });

  it("full nonce → verify flow with valid signature", async () => {
    const { POST: noncePost } = await import("@/app/api/auth/nonce/route");
    const nonceReq = new Request("http://localhost:3000/api/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ wallet: "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr" }),
    });
    const nonceRes = await noncePost(nonceReq);
    expect(nonceRes.status).toBe(200);
    const { nonce, message } = await nonceRes.json();
    expect(nonce).toBeTruthy();
    expect(message).toBe(`Sweepr sign-in: ${nonce}`);

    const { POST: verifyPost } = await import("@/app/api/auth/verify/route");
    const verifyReq = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({
        wallet: "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr",
        signature: "mock-valid-signature",
        nonce,
      }),
    });
    const verifyRes = await verifyPost(verifyReq);
    expect(verifyRes.status).toBe(200);
    const body = await verifyRes.json();
    expect(body).toHaveProperty("token");
    expect(body).toHaveProperty("wallet");
  });

  it("rejects invalid nonce", async () => {
    const { POST } = await import("@/app/api/auth/verify/route");
    const req = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({
        wallet: "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr",
        signature: "abc",
        nonce: "nonexistent-nonce",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("NONCE_INVALID");
  });

  it("rejects invalid signature (verifyWalletSignature returns false)", async () => {
    const { verifyWalletSignature } = await import("@/lib/auth");
    vi.mocked(verifyWalletSignature).mockResolvedValueOnce(false);

    redisStore.set("nonce:6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr", "test-nonce");
    const { POST } = await import("@/app/api/auth/verify/route");
    const req = new Request("http://localhost:3000/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({
        wallet: "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr",
        signature: "invalid-signature",
        nonce: "test-nonce",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
