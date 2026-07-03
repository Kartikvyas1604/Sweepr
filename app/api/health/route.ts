import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError } from "@/lib/errors";
import { redis } from "@/lib/redis";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await withRateLimit(request, 10, "1m");

    const checks: Record<string, string> = {};

    try {
      await redis.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    }

    try {
      const { error } = await supabase.from("pools").select("id", { count: "exact", head: true });
      checks.supabase = error ? "error" : "ok";
    } catch {
      checks.supabase = "error";
    }

    const healthy = Object.values(checks).every((s) => s === "ok");

    return Response.json({
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
