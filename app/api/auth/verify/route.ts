import { z } from "zod";
import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError } from "@/lib/errors";
import {
  verifyAndConsumeNonce,
  verifyWalletSignature,
  issueJWT,
} from "@/lib/auth";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  wallet: z.string(),
  signature: z.string(),
  nonce: z.string(),
});

export async function POST(request: Request) {
  try {
    await withRateLimit(request, 10, "1m");

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return handleRouteError(parsed.error);
    }

    const { wallet, signature, nonce } = parsed.data;

    const nonceValid = await verifyAndConsumeNonce(wallet, nonce);
    if (!nonceValid) {
      return Response.json(
        {
          error: "Nonce invalid or expired",
          code: "NONCE_INVALID",
          status: 400,
        },
        { status: 400 },
      );
    }

    const signatureValid = verifyWalletSignature(wallet, signature, nonce);
    if (!signatureValid) {
      logger.warn("Signature verification failed", { wallet });
      return Response.json(
        {
          error: "Signature verification failed",
          code: "SIGNATURE_INVALID",
          status: 401,
        },
        { status: 401 },
      );
    }

    const token = await issueJWT(wallet);
    const expiresAt = new Date(
      Date.now() + 86400 * 1000,
    ).toISOString();

    logger.info("Wallet authenticated", { wallet });

    return Response.json({ token, wallet, expiresAt });
  } catch (e) {
    return handleRouteError(e);
  }
}
