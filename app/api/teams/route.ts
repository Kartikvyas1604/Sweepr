import { withRateLimit } from "@/lib/ratelimit";
import { handleRouteError } from "@/lib/errors";
import { getAllTeams } from "@/lib/txline";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    await withRateLimit(request, 30, "1m");

    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get("poolId");

    const teams = await getAllTeams();

    let assignedTeamIds: string[] | undefined;

    if (poolId) {
      const { data: members } = await supabaseAdmin
        .from("pool_members")
        .select("team_id")
        .eq("pool_id", poolId);

      assignedTeamIds = members?.map((m) => m.team_id) ?? [];
    }

    return Response.json({
      teams,
      ...(assignedTeamIds ? { assignedTeamIds } : {}),
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
