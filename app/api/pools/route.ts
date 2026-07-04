import { z } from "zod";
import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError } from "@/lib/errors";
import { ApiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateJoinCode } from "@/lib/pools";
import { deriveEscrowPDA, callInitializePool } from "@/lib/solana";
import { publishPoolUpdate } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  name: z.string().min(3).max(60),
  entryFeeUsdc: z.number().min(0),
  maxMembers: z.number().int().min(2).max(32).default(32),
});

export async function POST(request: Request) {
  try {
    const { wallet } = await requireAuth(request);
    await withRateLimit(request, 5, "1m", wallet);

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return handleRouteError(parsed.error);
    }

    const { name, entryFeeUsdc, maxMembers } = parsed.data;

    if (entryFeeUsdc > 0 && entryFeeUsdc < 1) {
      throw new ApiError(400, "INVALID_FEE", "Entry fee must be 0 or at least 1 USDC");
    }

    const joinCode = await generateJoinCode();
    const poolId = crypto.randomUUID();

    let escrowPda: string | null = null;
    if (entryFeeUsdc > 0) {
      const [pda] = deriveEscrowPDA(poolId);
      escrowPda = pda.toString();
    }

    const { data: pool, error } = await supabaseAdmin
      .from("pools")
      .insert({
        id: poolId,
        name,
        created_by: wallet,
        join_code: joinCode,
        entry_fee_usdc: entryFeeUsdc,
        max_members: maxMembers,
        escrow_pda: escrowPda,
      })
      .select()
      .single();

    if (error || !pool) {
      logger.error("Failed to create pool", { error, wallet });
      throw new ApiError(500, "POOL_CREATE_FAILED", "Failed to create pool");
    }

    if (entryFeeUsdc > 0) {
      callInitializePool(poolId, entryFeeUsdc, maxMembers).catch((e) => {
        logger.warn("On-chain pool init failed (non-blocking)", {
          poolId,
          error: String(e),
        });
      });
    }

    await publishPoolUpdate(pool.id, {
      type: "heartbeat",
      poolId: pool.id,
      timestamp: Date.now(),
      data: { action: "created", wallet },
    });

    logger.info("Pool created", { poolId: pool.id, wallet, joinCode });

    return Response.json({
      pool: {
        id: pool.id,
        name: pool.name,
        joinCode: pool.join_code,
        status: pool.status,
        entryFeeUsdc: Number(pool.entry_fee_usdc),
        maxMembers: pool.max_members,
        escrowPda: pool.escrow_pda,
        createdAt: pool.created_at,
      },
      joinUrl: `${env.NEXT_PUBLIC_APP_URL}/join/${joinCode}`,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
