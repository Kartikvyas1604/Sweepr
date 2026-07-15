import { z } from "zod";

export const TxLINETeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  flagUrl: z.string(),
  group: z.string(),
  fifaRanking: z.number(),
});

export type TxLINETeam = z.infer<typeof TxLINETeamSchema>;

export const TxLINEFixtureSchema = z.object({
  id: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  homeTeamName: z.string(),
  awayTeamName: z.string(),
  homeScore: z.number(),
  awayScore: z.number(),
  status: z.enum(["scheduled", "live", "finished", "postponed"]),
  kickoff: z.string(),
  minute: z.number().nullable(),
  stage: z.string(),
  group: z.string().nullable(),
  homeFlagUrl: z.string().optional(),
  awayFlagUrl: z.string().optional(),
});

export type TxLINEFixture = z.infer<typeof TxLINEFixtureSchema>;

export const TxLINEEventSchema = z.object({
  id: z.string(),
  fixtureId: z.string(),
  teamId: z.string(),
  type: z.enum(["goal", "own_goal", "penalty", "red_card", "yellow_card"]),
  minute: z.number(),
  playerName: z.string().nullable(),
  detail: z.string().nullable(),
});

export type TxLINEEvent = z.infer<typeof TxLINEEventSchema>;

export const TxLINEStandingsTeamSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
  played: z.number(),
  won: z.number(),
  drawn: z.number(),
  lost: z.number(),
  goalsFor: z.number(),
  goalsAgainst: z.number(),
  points: z.number(),
});

export const TxLINEStandingsSchema = z.object({
  group: z.string(),
  teams: z.array(TxLINEStandingsTeamSchema),
});

export type TxLINEStandings = z.infer<typeof TxLINEStandingsSchema>;

export interface FixtureOption {
  id: string;
  label: string;
  homeTeam: { id: string; name: string; flagUrl?: string };
  awayTeam: { id: string; name: string; flagUrl?: string };
  kickoff: string;
  stage: string;
  group: string | null;
  status: "scheduled" | "live" | "finished";
}
