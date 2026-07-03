import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError } from "@/lib/errors";
import { generateNonce, storeNonce } from "@/lib/auth";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  wallet: z.string().min(32).max(44),
});

export async function POST(request: Request) {
  try {
    await withRateLimit(request, 10, "1m");

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return handleRouteError(parsed.error);
    }

    const { wallet } = parsed.data;

    try {
      new PublicKey(wallet);
    } catch {
      return Response.json(
        { error: "Invalid wallet address", code: "INVALID_WALLET", status: 400 },
        { status: 400 },
      );
    }

    const nonce = generateNonce();
    await storeNonce(wallet, nonce);

    logger.info("Nonce generated", { wallet });

    return Response.json({
      nonce,
      message: `Sweepr sign-in: ${nonce}`,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
