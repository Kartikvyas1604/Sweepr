import { handleRouteError, ApiError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase";
import { getLiveFixtures, getFixtureEvents } from "@/lib/txline";
import { processFixtureEvents, getPoolFixtureIds } from "@/lib/scoring";
import { publishPoolUpdate } from "@/lib/redis";
import { callUpdateScore } from "@/lib/solana";
import { computeLeaderboard } from "@/lib/pools";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { verifySecret } from "@/lib/security";

export async function POST(request: Request) {
  try {
    if (!verifySecret(request.headers.get("x-inngest-key") ?? "", env.INNGEST_EVENT_KEY)) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid Inngest key");
    }

    const { data: activePools } = await supabaseAdmin
      .from("pools")
      .select("id, created_by, scope")
      .eq("status", "active");

    if (!activePools || activePools.length === 0) {
      return Response.json({ poolsProcessed: 0, eventsProcessed: 0, newGoals: 0 });
    }

    const liveFixtures = await getLiveFixtures();
    if (liveFixtures.length === 0) {
      return Response.json({
        poolsProcessed: activePools.length,
        eventsProcessed: 0,
        newGoals: 0,
      });
    }

    let totalEventsProcessed = 0;
    let totalNewGoals = 0;

    for (const pool of activePools) {
      logger.info("Processing pool score sync", { poolId: pool.id, scope: pool.scope });

      const allowedFixtureIds = await getPoolFixtureIds(
        pool.id,
        pool.scope || "all",
      );

      const { data: members } = await supabaseAdmin
        .from("pool_members")
        .select("id, wallet, team_id, display_name, team_name, team_flag_url")
        .eq("pool_id", pool.id);

      if (!members || members.length === 0) continue;

      const memberLookups = members.map((m) => ({
        teamId: m.team_id,
        memberId: m.id,
        wallet: m.wallet,
        poolId: pool.id,
      }));

      const memberInfo = new Map(
        members.map((m) => [
          m.id,
          { displayName: m.display_name, teamName: m.team_name, teamFlagUrl: m.team_flag_url },
        ]),
      );

      const { data: nonceRows } = await supabaseAdmin
        .from("processed_nonces")
        .select("nonce")
        .eq("pool_id", pool.id);

      const processedNonces = new Set(nonceRows?.map((n: any) => n.nonce) ?? []);

      for (const fixture of liveFixtures) {
        if (allowedFixtureIds !== "all" && !allowedFixtureIds.includes(fixture.id)) {
          continue;
        }

        const events = await getFixtureEvents(fixture.id);
        if (events.length === 0) continue;

        const results = processFixtureEvents(
          events,
          memberLookups,
          processedNonces,
          allowedFixtureIds,
          liveFixtures,
        );

        for (const result of results) {
          const { error: insertError } = await supabaseAdmin
            .from("score_events")
            .insert({
              pool_id: result.poolId,
              member_id: result.memberId,
              fixture_id: result.fixtureId,
              event_type: result.eventType,
              minute: result.minute,
              player_name: result.playerName,
              team_id: result.teamId,
              points_awarded: result.points,
              txline_event_id: result.eventId,
            });

          if (insertError) {
            if (insertError.code === "23505") continue;
            logger.error("Score event insert error", {
              poolId: pool.id,
              error: insertError,
            });
            continue;
          }

          const { error: updateError } = await supabaseAdmin.rpc(
            "increment_score",
            { p_member_id: result.memberId, p_points: result.points },
          );

          if (updateError) {
            logger.error("Score update error", {
              memberId: result.memberId,
              error: updateError,
            });
            continue;
          }

          const { data: updated } = await supabaseAdmin
            .from("pool_members")
            .select("score")
            .eq("id", result.memberId)
            .single();

          const info = memberInfo.get(result.memberId);
          const newLeaderboard = await computeLeaderboard(pool.id);

          await publishPoolUpdate(pool.id, {
            type: "score_update",
            poolId: pool.id,
            timestamp: Date.now(),
            data: {
              memberId: result.memberId,
              memberName: info?.displayName ?? "Unknown",
              teamName: info?.teamName ?? "",
              teamFlagUrl: info?.teamFlagUrl ?? null,
              eventType: result.eventType,
              points: result.points,
              minute: result.minute,
              playerName: result.playerName,
              newScore: updated?.score ?? 0,
              newLeaderboard,
            },
          });

          try {
            await callUpdateScore(pool.id, result.wallet, result.points, result.eventId);
          } catch (e) {
            logger.warn("On-chain score update failed, enqueuing retry", {
              poolId: pool.id,
              eventId: result.eventId,
              error: String(e),
            });
            await supabaseAdmin.from("onchain_retry_queue").insert({
              action: "update_score",
              pool_id: pool.id,
              payload: {
                memberWallet: result.wallet,
                points: result.points,
                eventNonce: result.eventId,
              },
              next_retry_at: new Date(Date.now() + 30000).toISOString(),
            }).maybeSingle();
          }

          await supabaseAdmin
            .from("processed_nonces")
            .insert({ nonce: result.eventId, pool_id: pool.id })
            .maybeSingle();

          totalEventsProcessed++;
          totalNewGoals++;
        }
      }
    }

    logger.info("Score sync complete", {
      poolsProcessed: activePools.length,
      eventsProcessed: totalEventsProcessed,
      newGoals: totalNewGoals,
    });

    return Response.json({
      poolsProcessed: activePools.length,
      eventsProcessed: totalEventsProcessed,
      newGoals: totalNewGoals,
    });
  } catch (e) {
    return handleRouteError(e);
  }
}
