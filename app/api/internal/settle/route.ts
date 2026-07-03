import { handleRouteError, ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase";
import { computeLeaderboard } from "@/lib/pools";
import { callSettlePool } from "@/lib/solana";
import { publishPoolUpdate } from "@/lib/redis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    const authKey = request.headers.get("x-inngest-key");
    if (authKey !== env.INNGEST_EVENT_KEY) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid Inngest key");
    }

    const { data: activePools } = await supabaseAdmin
      .from("pools")
      .select("id, entry_fee_usdc, escrow_pda")
      .eq("status", "active");

    if (!activePools || activePools.length === 0) {
      return Response.json({ settled: 0 });
    }

    let settledCount = 0;

    for (const pool of activePools) {
      try {
        const leaderboard = await computeLeaderboard(pool.id);

        if (leaderboard.length === 0) {
          logger.warn("Pool has no members, skipping settlement", { poolId: pool.id });
          await supabaseAdmin
            .from("pools")
            .update({ status: "settled", settled_at: new Date().toISOString() })
            .eq("id", pool.id);
          settledCount++;
          continue;
        }

        const winner = leaderboard[0];
        let txSig: string | null = null;

        if (Number(pool.entry_fee_usdc) > 0 && pool.escrow_pda) {
          try {
            txSig = await callSettlePool(pool.id, winner.wallet);
            logger.info("Pool settled on-chain", {
              poolId: pool.id,
              winner: winner.wallet,
              txSig,
            });
          } catch (e) {
            logger.error("On-chain settlement failed, settling off-chain", {
              poolId: pool.id,
              error: String(e),
            });
          }
        }

        await supabaseAdmin
          .from("pools")
          .update({
            status: "settled",
            winner_wallet: winner.wallet,
            settlement_tx: txSig,
            settled_at: new Date().toISOString(),
          })
          .eq("id", pool.id);

        await publishPoolUpdate(pool.id, {
          type: "pool_settled",
          poolId: pool.id,
          timestamp: Date.now(),
          data: {
            winnerWallet: winner.wallet,
            winnerName: winner.displayName,
            winnerTeam: winner.teamName,
            txSig,
            finalLeaderboard: leaderboard,
          },
        });

        settledCount++;
        logger.info("Pool settled", {
          poolId: pool.id,
          winner: winner.wallet,
        });
      } catch (e) {
        logger.error("Failed to settle pool", {
          poolId: pool.id,
          error: String(e),
        });
      }
    }

    return Response.json({ settled: settledCount });
  } catch (e) {
    return handleRouteError(e);
  }
}
