import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError } from "@/lib/errors";
import { computeLeaderboard } from "@/lib/pools";
import { readPoolUpdates } from "@/lib/redis";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ poolId: string }> },
) {
  try {
    await withRateLimit(request, 20, "1m");

    const { poolId } = await params;
    const encoder = new TextEncoder();
    let streamId = "0";
    let closed = false;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const leaderboard = await computeLeaderboard(poolId);
          controller.enqueue(
            encoder.encode(
              `event: snapshot\ndata: ${JSON.stringify({ leaderboard })}\n\n`,
            ),
          );
        } catch (e) {
          logger.warn("SSE initial snapshot failed", { poolId, error: String(e) });
        }

        const poll = async () => {
          while (!closed) {
            try {
              const events = await readPoolUpdates(poolId, streamId);
              for (const event of events) {
                streamId = event.id;
                controller.enqueue(
                  encoder.encode(
                    `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`,
                  ),
                );
              }
            } catch (e) {
              logger.warn("SSE poll error", { poolId, error: String(e) });
            }

            controller.enqueue(
              encoder.encode(
                `event: heartbeat\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`,
              ),
            );

            // FIX: heartbeat every 25s matches Vercel's idle timeout
            await new Promise((r) => setTimeout(r, 25000));
          }
        };

        poll();
      },
      cancel() {
        closed = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
