import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { z } from "zod";
import { env } from "./env";
import { logger } from "./logger";
import type { PoolUpdateEvent } from "@/types/api";

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

export async function cacheGet<T>(
  key: string,
  schema: z.ZodSchema<T>,
): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (raw === null) return null;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      logger.warn("Cache parse error, evicting", { key, error: parsed.error.message });
      await redis.del(key);
      return null;
    }
    return parsed.data;
  } catch (e) {
    logger.warn("Cache get error", { key, error: String(e) });
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (e) {
    logger.warn("Cache set error", { key, error: String(e) });
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (e) {
    logger.warn("Cache del error", { key, error: String(e) });
  }
}

export async function publishPoolUpdate(
  poolId: string,
  payload: PoolUpdateEvent,
): Promise<void> {
  try {
    await redis.xadd(
      `stream:pool:${poolId}`,
      "*",
      { type: payload.type, data: JSON.stringify(payload) },
    );
  } catch (e) {
    logger.error("Redis stream publish error", {
      poolId,
      type: payload.type,
      error: String(e),
    });
  }
}

const PoolUpdateEventDataSchema = z.object({
  type: z.string(),
  data: z.string(),
});

export async function readPoolUpdates(
  poolId: string,
  lastId: string,
): Promise<Array<{ id: string; type: string; data: Record<string, unknown> }>> {
  try {
    const response = await redis.xread("STREAMS", `stream:pool:${poolId}`, lastId, {
      COUNT: 100,
    });
    if (!response || response.length === 0) return [];

    const messages: Array<{ id: string; type: string; data: Record<string, unknown> }> = [];
    for (const [, entries] of response) {
      for (const [id, fields] of entries) {
        const parsed = PoolUpdateEventDataSchema.safeParse(fields);
        if (!parsed.success) continue;
        try {
          messages.push({
            id,
            type: parsed.data.type,
            data: JSON.parse(parsed.data.data),
          });
        } catch {
          continue;
        }
      }
    }
    return messages;
  } catch (e) {
    logger.warn("Redis stream read error", { poolId, error: String(e) });
    return [];
  }
}

export function getRateLimiter(
  identifier: string,
  limit: number,
  window: "1m" | "5m" | "1h",
) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: true,
    prefix: `ratelimit:${identifier}`,
  });
}
