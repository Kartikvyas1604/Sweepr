import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError } from "@/lib/errors";
import { getFixtures, getLiveFixtures } from "@/lib/txline";

export async function GET(request: Request) {
  try {
    await withRateLimit(request, 30, "1m");

    const { searchParams } = new URL(request.url);
    const liveOnly = searchParams.get("live") === "true";

    const fixtures = liveOnly ? await getLiveFixtures() : await getFixtures();

    return Response.json({ fixtures });
  } catch (e) {
    return handleRouteError(e);
  }
}
