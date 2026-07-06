import { handleRouteError, ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase";
import { callInitializePool, derivePoolPDA } from "@/lib/solana";
import { getConnection } from "@/lib/solana";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization")?.replace("Bearer ", "");
    if (auth !== env.INNGEST_SIGNING_KEY) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid admin key");
    }

    const { poolId } = await request.json();
    if (!poolId) {
      throw new ApiError(400, "POOL_ID_REQUIRED", "poolId is required");
    }

    const { data: pool, error: poolError } = await supabaseAdmin
      .from("pools")
      .select("*")
      .eq("id", poolId)
      .single();

    if (poolError || !pool) {
      throw new ApiError(404, "POOL_NOT_FOUND", "Pool not found");
    }

    const [poolPda] = derivePoolPDA(poolId);
    const accountInfo = await getConnection().getAccountInfo(poolPda);

    if (accountInfo) {
      return Response.json({
        status: "already_initialized",
        pda: poolPda.toString(),
        msg: "Pool PDA already exists on-chain",
      });
    }

    const entryFeeUsdc = Number(pool.entry_fee_usdc);
    const txSig = await callInitializePool(
      poolId,
      entryFeeUsdc,
      pool.max_members,
    );

    logger.info("Pool repaired on-chain", { poolId, txSig });

    return Response.json({
      status: "initialized",
      txSig,
      pda: poolPda.toString(),
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
