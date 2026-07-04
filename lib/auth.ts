import { SignJWT, jwtVerify } from "jose";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { env } from "./env";
import { redis } from "./redis";
import { ApiError } from "./errors";
import { logger } from "./logger";

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);
const SIGN_MESSAGE_PREFIX = "Sweepr sign-in: ";

export function generateNonce(): string {
  return crypto.randomUUID();
}

export async function storeNonce(wallet: string, nonce: string): Promise<void> {
  await redis.set(`nonce:${wallet}`, nonce, { ex: 300 });
}

export async function verifyAndConsumeNonce(
  wallet: string,
  nonce: string,
): Promise<boolean> {
  const stored = await redis.get<string>(`nonce:${wallet}`);
  if (!stored || stored !== nonce) return false;
  await redis.del(`nonce:${wallet}`);
  return true;
}

export async function verifyWalletSignature(
  wallet: string,
  signature: string,
  nonce: string,
): Promise<boolean> {
  try {
    const publicKeyBytes = bs58.decode(wallet);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(`${SIGN_MESSAGE_PREFIX}${nonce}`);

    // Try tweetnacl first (most compatible)
    const naclResult = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes,
    );
    if (naclResult) return true;

    logger.warn("tweetnacl verify failed, trying Web Crypto", {
      wallet,
      nonce,
      expectedMsg: `${SIGN_MESSAGE_PREFIX}${nonce}`,
      sigLen: signatureBytes.length,
      pubLen: publicKeyBytes.length,
      msgLen: messageBytes.length,
      sigPrefix: Array.from(signatureBytes.slice(0, 8)).join(","),
    });

    // Fallback: try with Web Crypto (Ed25519)
    try {
      const key = await crypto.subtle.importKey(
        "raw",
        Buffer.from(publicKeyBytes),
        { name: "Ed25519" },
        false,
        ["verify"],
      );
      const webResult = await crypto.subtle.verify(
        "Ed25519",
        key,
        Buffer.from(signatureBytes),
        Buffer.from(messageBytes),
      );
      if (webResult) {
        logger.info("Web Crypto fallback succeeded", { wallet });
        return true;
      }
      logger.warn("Web Crypto also rejected the signature", { wallet });
    } catch (e) {
      logger.warn("Web Crypto Ed25519 not available", { wallet, error: String(e) });
    }

    logger.warn("All signature verification methods failed", { wallet });
    return false;
  } catch (e) {
    logger.warn("Signature verification threw", { wallet, error: String(e) });
    return false;
  }
}

export async function issueJWT(wallet: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ wallet, sub: wallet })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + env.JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyJWT(
  token: string,
): Promise<{ wallet: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (typeof payload.wallet !== "string") return null;
    return { wallet: payload.wallet };
  } catch {
    return null;
  }
}

export async function requireAuth(
  request: Request,
): Promise<{ wallet: string }> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError(401, "Unauthorized", "Missing or invalid Authorization header");
  }
  const token = authHeader.slice(7);
  const result = await verifyJWT(token);
  if (!result) {
    throw new ApiError(401, "Unauthorized", "Invalid or expired token");
  }
  return result;
}
