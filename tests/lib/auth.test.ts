import { describe, it, expect, vi, beforeEach } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import {
  generateNonce,
  verifyWalletSignature,
  issueJWT,
  verifyJWT,
  requireAuth,
} from "@/lib/auth";
import { ApiError } from "@/lib/errors";

vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
  },
}));

describe("generateNonce", () => {
  it("returns a string of 36 characters", () => {
    const nonce = generateNonce();
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBe(36);
  });

  it("returns different values on each call", () => {
    const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));
    expect(nonces.size).toBe(100);
  });
});

describe("verifyWalletSignature", () => {
  it("returns true for a valid signature from a real Solana keypair", async () => {
    const keypair = Keypair.generate();
    const wallet = keypair.publicKey.toBase58();
    const nonce = "test-nonce-123";
    const messageBytes = new TextEncoder().encode(`Sweepr sign-in: ${nonce}`);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const sigBase58 = bs58.encode(signature);
    const result = await verifyWalletSignature(wallet, sigBase58, nonce);
    expect(result).toBe(true);
  });

  it("returns false for a signature from a different keypair", async () => {
    const keypair = Keypair.generate();
    const otherPair = Keypair.generate();
    const wallet = keypair.publicKey.toBase58();
    const nonce = "test-nonce-123";
    const messageBytes = new TextEncoder().encode(`Sweepr sign-in: ${nonce}`);
    // Sign with different keypair
    const signature = nacl.sign.detached(messageBytes, otherPair.secretKey);
    const sigBase58 = bs58.encode(signature);
    const result = await verifyWalletSignature(wallet, sigBase58, nonce);
    expect(result).toBe(false);
  });

  it("returns false for a tampered message", async () => {
    const keypair = Keypair.generate();
    const wallet = keypair.publicKey.toBase58();
    const nonce = "test-nonce-123";
    const messageBytes = new TextEncoder().encode(`Sweepr sign-in: ${nonce}`);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const sigBase58 = bs58.encode(signature);
    const result = await verifyWalletSignature(wallet, sigBase58, "different-nonce");
    expect(result).toBe(false);
  });

  it("returns false for an empty signature string", async () => {
    const result = await verifyWalletSignature(
      "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr",
      "",
      "nonce-123",
    );
    expect(result).toBe(false);
  });

  it("returns false for an invalid base58 signature", async () => {
    const result = await verifyWalletSignature(
      "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr",
      "!!!not-valid-base58!!!",
      "nonce-123",
    );
    expect(result).toBe(false);
  });
});

describe("issueJWT + verifyJWT", () => {
  it("issues a JWT containing the wallet address", async () => {
    const token = await issueJWT("wallet123");
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
    const payload = await verifyJWT(token);
    expect(payload).not.toBeNull();
    expect(payload!.wallet).toBe("wallet123");
  });

  it("verifyJWT returns the wallet from a valid token", async () => {
    const token = await issueJWT("test-wallet-addr");
    const result = await verifyJWT(token);
    expect(result).not.toBeNull();
    expect(result!.wallet).toBe("test-wallet-addr");
  });

  it("verifyJWT returns null for an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { SignJWT } = await import("jose");
    const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "test-jwt-secret-that-is-at-least-32-chars!!");
    const token = await new SignJWT({ wallet: "test" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 10)
      .setExpirationTime(now - 5)
      .sign(JWT_SECRET);
    const result = await verifyJWT(token);
    expect(result).toBeNull();
  });

  it("verifyJWT returns null for a tampered token", async () => {
    const token = await issueJWT("test-wallet");
    const parts = token.split(".");
    parts[2] = "tampered";
    const result = await verifyJWT(parts.join("."));
    expect(result).toBeNull();
  });

  it("verifyJWT returns null for garbage input", async () => {
    const result = await verifyJWT("this.is.not.a.jwt");
    expect(result).toBeNull();
  });
});

describe("requireAuth", () => {
  it("throws ApiError 401 when Authorization header is missing", async () => {
    const req = new Request("http://localhost:3000/api/test");
    await expect(requireAuth(req)).rejects.toThrow(ApiError);
    await expect(requireAuth(req)).rejects.toMatchObject({
      status: 401,
      code: "Unauthorized",
    });
  });

  it("throws ApiError 401 when token is invalid", async () => {
    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    await expect(requireAuth(req)).rejects.toThrow(ApiError);
  });

  it("returns wallet when token is valid", async () => {
    const token = await issueJWT("wallet-test-abc");
    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await requireAuth(req);
    expect(result.wallet).toBe("wallet-test-abc");
  });
});
