import { ApiError } from "./errors";
import { getRateLimiter } from "./redis";
import { logger } from "./logger";

export interface RateLimitResult {
  remaining: number;
  limit: number;
  reset: number;
}

export async function withRateLimit(
  request: Request,
  limit: number,
  window: "1m" | "5m" | "1h",
  identifier?: string,
): Promise<RateLimitResult> {
  const ip =
    identifier ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  try {
    const ratelimit = getRateLimiter(`route:${ip}`, limit, window);
    const result = await ratelimit.limit(ip);

    if (!result.success) {
      throw new ApiError(429, "RATE_LIMITED", "Too many requests");
    }

    return {
      remaining: result.remaining,
      limit: result.limit,
      reset: result.reset,
    };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    logger.warn("Rate limit check failed, failing open", { ip, error: String(e) });
    return { remaining: 1, limit, reset: 0 };
  }
}
