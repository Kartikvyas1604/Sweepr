import { corsHeaders } from "./cors";
import type { RateLimitResult } from "./ratelimit";

export function jsonResponse(
  data: unknown,
  init?: ResponseInit,
  request?: Request,
  rateLimit?: RateLimitResult,
): Response {
  const headers = new Headers(init?.headers);
  if (request) {
    const cors = corsHeaders(request);
    for (const [key, value] of Object.entries(cors)) {
      headers.set(key, value);
    }
  }
  if (rateLimit) {
    headers.set("X-RateLimit-Limit", String(rateLimit.limit));
    headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
    headers.set("X-RateLimit-Reset", String(rateLimit.reset));
  }
  return Response.json(data, { ...init, headers });
}
