import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { syncLiveScores, settleTournament } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncLiveScores, settleTournament],
});
