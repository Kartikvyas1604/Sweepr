"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveIndicator } from "@/components/ui/live-indicator";
import { EscrowStatus } from "@/components/ui/escrow-status";
import { LeaderboardRow, LeaderboardHeader } from "@/components/ui/leaderboard-row";
import { Button } from "@/components/ui/button";
import { GoalOverlay } from "@/components/ui/goal-overlay";
import { TopNav } from "@/components/ui/top-nav";
import { ShareButton } from "@/components/ui/share-button";
import type { Participant } from "@/lib/types";
import { Trophy, Goal } from "lucide-react";

const MOCK_PARTICIPANTS: Participant[] = [
  { id: "1", name: "Alex", walletAddress: "0x1234...5678", team: { name: "Brazil", flag: "🇧🇷", group: "A" }, score: 12, rank: 1 },
  { id: "2", name: "Jordan", walletAddress: "0x2345...6789", team: { name: "Argentina", flag: "🇦🇷", group: "A" }, score: 10, rank: 2 },
  { id: "3", name: "Sam", walletAddress: "0x3456...7890", team: { name: "France", flag: "🇫🇷", group: "B" }, score: 8, rank: 3 },
  { id: "4", name: "Taylor", walletAddress: "0x4567...8901", team: { name: "Spain", flag: "🇪🇸", group: "C" }, score: 7, rank: 4 },
  { id: "5", name: "Morgan", walletAddress: "0x5678...9012", team: { name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "B" }, score: 6, rank: 5 },
  { id: "6", name: "Riley", walletAddress: "0x6789...0123", team: { name: "Germany", flag: "🇩🇪", group: "C" }, score: 6, rank: 6 },
  { id: "7", name: "Casey", walletAddress: "0x7890...1234", team: { name: "Portugal", flag: "🇵🇹", group: "D" }, score: 5, rank: 7 },
  { id: "8", name: "You", walletAddress: "0x8901...2345", team: { name: "Netherlands", flag: "🇳🇱", group: "D" }, score: 4, rank: 8 },
];

export default function PoolPage() {
  const params = useParams();
  const [participants, setParticipants] = useState(MOCK_PARTICIPANTS);
  const [lastGoal, setLastGoal] = useState<string | null>(null);
  const [showGoalOverlay, setShowGoalOverlay] = useState(false);
  const [lastScorer, setLastScorer] = useState({ name: "", flag: "" });

  // Mock goal event — simulates a TxLINE push
  const simulateGoal = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * participants.length);
    const targetId = participants[randomIndex].id;
    const scorer = participants[randomIndex];

    setParticipants((prev) =>
      prev
        .map((p) =>
          p.id === targetId ? { ...p, score: p.score + 1 } : p,
        )
        .sort((a, b) => b.score - a.score || a.rank - b.rank)
        .map((p, i) => ({ ...p, rank: i + 1 })),
    );

    setLastScorer({ name: scorer.name, flag: scorer.team.flag });
    setLastGoal(targetId);
    setShowGoalOverlay(true);
    setTimeout(() => {
      setLastGoal(null);
      setShowGoalOverlay(false);
    }, 2000);
  }, [participants]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <TopNav
        title="Office Cup 26"
        showBack
        backHref="/pools"
        right={<ShareButton poolId={params.id as string} />}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:gap-6 sm:py-8">
        {/* Pool header */}
        <motion.div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-display text-2xl uppercase tracking-tight text-chalk sm:text-3xl">
                Office Cup 26
              </h1>
              <div className="mt-1 flex items-center gap-3">
                <LiveIndicator />
                <Badge variant="default" size="sm">8 players</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={simulateGoal}
            >
              <Goal className="h-3.5 w-3.5" />
              Sim Goal
            </Button>
          </div>
        </motion.div>

        {/* Escrow status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <EscrowStatus
            totalPot={80}
            participantCount={8}
            entryFee={10}
            status="locked"
            fee={0.025}
          />
        </motion.div>

        {/* Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-goalnet" />
                  <span className="font-display text-sm uppercase tracking-wider text-chalk">
                    Leaderboard
                  </span>
                </div>
                <LiveIndicator />
              </div>
              <LeaderboardHeader />
            </CardHeader>
            <CardContent className="p-0">
              {participants.map((participant, index) => (
                <motion.div
                  key={participant.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05, duration: 0.3 }}
                >
                  <LeaderboardRow
                    participant={participant}
                    rank={participant.rank}
                    isCurrentUser={participant.name === "You"}
                    highlight={lastGoal === participant.id}
                  />
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Live matches ticker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flare opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-flare" />
                </span>
                <span className="font-display text-sm uppercase tracking-wider text-chalk">
                  Live Matches
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-md bg-chalk/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🇧🇷</span>
                  <span className="font-body text-sm font-medium text-chalk">Brazil</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-xl tabular-nums text-chalk">2</span>
                  <span className="font-mono text-[10px] text-chalk-muted/40">vs</span>
                  <span className="font-display text-xl tabular-nums text-chalk">1</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-body text-sm font-medium text-chalk">Serbia</span>
                  <span className="text-lg">🇷🇸</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md bg-chalk/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🇦🇷</span>
                  <span className="font-body text-sm font-medium text-chalk">Argentina</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-xl tabular-nums text-chalk">0</span>
                  <span className="font-mono text-[10px] text-chalk-muted/40">vs</span>
                  <span className="font-display text-xl tabular-nums text-chalk">0</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-body text-sm font-medium text-chalk">Mexico</span>
                  <span className="text-lg">🇲🇽</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Goal overlay */}
      <GoalOverlay
        show={showGoalOverlay}
        scorerName={lastScorer.name}
        teamFlag={lastScorer.flag}
      />
    </div>
  );
}
