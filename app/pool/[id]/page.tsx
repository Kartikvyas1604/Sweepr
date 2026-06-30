"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { getPoolWithParticipants } from "@/lib/store";
import type { Participant, Pool } from "@/lib/types";
import { Trophy, Goal, Coins, Globe, EyeOff, AlertCircle } from "lucide-react";

export default function PoolPage() {
  const params = useParams();
  const router = useRouter();
  const [poolData, setPoolData] = useState<{ pool: Pool; participants: Participant[] } | null>(null);
  const [lastGoal, setLastGoal] = useState<string | null>(null);
  const [showGoalOverlay, setShowGoalOverlay] = useState(false);
  const [lastScorer, setLastScorer] = useState({ name: "", flag: "" });

  useEffect(() => {
    const data = getPoolWithParticipants(params.id as string);
    if (data.pool) {
      setPoolData(data as { pool: Pool; participants: Participant[] });
    }
  }, [params.id]);

  const simulateGoal = useCallback(() => {
    if (!poolData) return;
    const { participants } = poolData;
    if (participants.length === 0) return;
    const randomIndex = Math.floor(Math.random() * participants.length);
    const targetId = participants[randomIndex].id;
    const scorer = participants[randomIndex];

    setPoolData((prev) => {
      if (!prev) return prev;
      const updated = prev.participants
        .map((p) =>
          p.id === targetId ? { ...p, score: p.score + 1 } : p,
        )
        .sort((a, b) => b.score - a.score || a.rank - b.rank)
        .map((p, i) => ({ ...p, rank: i + 1 }));
      return { ...prev, participants: updated };
    });

    setLastScorer({ name: scorer.name, flag: scorer.team.flag });
    setLastGoal(targetId);
    setShowGoalOverlay(true);
    setTimeout(() => {
      setLastGoal(null);
      setShowGoalOverlay(false);
    }, 2000);
  }, [poolData]);

  if (!poolData) {
    return (
      <div className="relative flex min-h-dvh flex-col">
        <TopNav title="Pool" showBack backHref="/pools" />
        <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-12">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <AlertCircle className="h-8 w-8 text-accent" />
              <p className="font-display text-sm uppercase tracking-wider text-ink">Pool not found</p>
              <Button size="sm" onClick={() => router.push("/")}>Create a pool</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { pool, participants } = poolData;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <TopNav
        title={pool.name}
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
              <h1 className="font-display text-2xl uppercase tracking-tight text-ink sm:text-3xl">
                {pool.name}
              </h1>
              <div className="mt-1 flex items-center gap-3">
                <LiveIndicator />
                <Badge variant="elevated" size="sm">{participants.length} players</Badge>
                {pool.isPrivate ? (
                  <Badge variant="outline" size="sm">
                    <EyeOff className="h-2.5 w-2.5" />
                    Private
                  </Badge>
                ) : (
                  <Badge variant="outline" size="sm">
                    <Globe className="h-2.5 w-2.5" />
                    Public
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={simulateGoal}
              disabled={participants.length === 0}
            >
              <Goal className="h-3.5 w-3.5" />
              Sim Goal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push(`/pool/${params.id}/settle`)}
              disabled={participants.length === 0}
            >
              <Coins className="h-3.5 w-3.5" />
              Settle
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
            totalPot={pool.totalPot}
            participantCount={participants.length}
            entryFee={pool.entryFee}
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
                  <Trophy className="h-4 w-4 text-money" />
                  <span className="font-display text-sm uppercase tracking-wider text-ink">
                    Leaderboard
                  </span>
                </div>
                <LiveIndicator />
              </div>
              <LeaderboardHeader />
            </CardHeader>
            <CardContent className="p-0">
              {participants.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <p className="font-body text-sm text-ink-muted/40">No participants yet</p>
                  <Button size="sm" variant="secondary" onClick={() => router.push(`/join/${params.id}`)}>
                    Join this pool
                  </Button>
                </div>
              ) : (
                participants.map((participant, index) => (
                  <motion.div
                    key={participant.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.05, duration: 0.3 }}
                  >
                    <LeaderboardRow
                      participant={participant}
                      rank={participant.rank}
                      highlight={lastGoal === participant.id}
                    />
                  </motion.div>
                ))
              )}
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
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <span className="font-display text-sm uppercase tracking-wider text-ink">
                  Live Matches
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-md bg-elevated/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🇧🇷</span>
                  <span className="font-body text-sm font-medium text-ink">Brazil</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-xl tabular-nums text-ink">2</span>
                  <span className="font-mono text-[10px] text-ink-muted/40">vs</span>
                  <span className="font-display text-xl tabular-nums text-ink">1</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-body text-sm font-medium text-ink">Serbia</span>
                  <span className="text-lg">🇷🇸</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md bg-elevated/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg">🇦🇷</span>
                  <span className="font-body text-sm font-medium text-ink">Argentina</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-xl tabular-nums text-ink">0</span>
                  <span className="font-mono text-[10px] text-ink-muted/40">vs</span>
                  <span className="font-display text-xl tabular-nums text-ink">0</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-body text-sm font-medium text-ink">Mexico</span>
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
