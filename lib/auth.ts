import { SignJWT, jwtVerify } from "jose";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { env } from "./env";
import { redis } from "./redis";
import { ApiError } from "./errors";

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

export function verifyWalletSignature(
  wallet: string,
  signature: string,
  nonce: string,
): boolean {
  try {
    const publicKeyBytes = bs58.decode(wallet);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(`${SIGN_MESSAGE_PREFIX}${nonce}`);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
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
