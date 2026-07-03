import { inngest } from "./client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const syncLiveScores = inngest.createFunction(
  { id: "sync-live-scores", name: "Sync Live Scores from TxLINE" },
  { cron: "*/30 * * * *" },
  async ({ step }) => {
    await step.run("fetch-and-process", async () => {
      const response = await fetch(
        `${env.NEXT_PUBLIC_APP_URL}/api/internal/score-sync`,
        {
          method: "POST",
          headers: { "x-inngest-key": env.INNGEST_EVENT_KEY },
        },
      );

      if (!response.ok) {
        const body = await response.text();
        logger.error("Score sync failed", { status: response.status, body });
        throw new Error(`Score sync returned ${response.status}`);
      }

      return response.json();
    });
  },
);

export const settleTournament = inngest.createFunction(
  { id: "settle-tournament", name: "Settle All Pools at Tournament End" },
  { event: "sweepr/tournament.end" },
  async ({ step }) => {
    await step.sleep("wait-for-final-whistle", "5m");

    await step.run("settle-all-pools", async () => {
      const response = await fetch(
        `${env.NEXT_PUBLIC_APP_URL}/api/internal/settle`,
        {
          method: "POST",
          headers: { "x-inngest-key": env.INNGEST_EVENT_KEY },
        },
      );

      if (!response.ok) {
        const body = await response.text();
        logger.error("Settlement failed", { status: response.status, body });
        throw new Error(`Settlement returned ${response.status}`);
      }

      return response.json();
    });
  },
);
