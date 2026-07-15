import { handleRouteError, ApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST() {
  return handleRouteError(
    new ApiError(
      410,
      "DEPRECATED",
      "Random team assignment has been replaced with team selection. Use the teams endpoint to list available teams, then pass teamId to the join endpoint.",
    ),
  );
}
