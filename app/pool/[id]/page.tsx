"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveIndicator } from "@/components/ui/live-indicator";
import { EscrowStatus } from "@/components/ui/escrow-status";
import { LeaderboardRow, LeaderboardHeader } from "@/components/ui/leaderboard-row";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/ui/top-nav";
import { ShareButton } from "@/components/ui/share-button";
import { api } from "@/lib/api-client";
import { Trophy, AlertCircle, Globe, Coins, Sparkles, EyeOff, Swords } from "lucide-react";

function poolStatusLabel(status: string): string {
  switch (status) {
    case "waiting": return "OPEN";
    case "active": return "LIVE";
    case "settled": return "SETTLED";
    case "onchain_failed": return "FAILED";
    default: return status.toUpperCase();
  }
}

function poolIsOpen(status: string): boolean {
  return status === "waiting" || status === "active";
}

function poolCanJoin(status: string): boolean {
  return status === "waiting";
}

function BattleCard({ participants }: { participants: any[] }) {
  const p1 = participants[0];
  const p2 = participants[1];
  if (!p1 || !p2) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-2">
        <Swords className="h-4 w-4 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
          Head to Head
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-money/10">
            {p1.teamFlagUrl ? (
              <img src={p1.teamFlagUrl} alt="" className="h-12 w-16 rounded-sm object-cover" />
            ) : (
              <span className="text-2xl">🏆</span>
            )}
          </div>
          <div className="text-center">
            <p className="font-display text-lg uppercase tracking-wider text-foreground">
              {p1.teamName}
            </p>
            <p className="font-body text-xs text-muted-foreground">{p1.displayName}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-3xl font-bold text-money">{p1.score}</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
              POINTS
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="font-display text-lg text-muted-foreground/30">VS</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-money/10">
            {p2.teamFlagUrl ? (
              <img src={p2.teamFlagUrl} alt="" className="h-12 w-16 rounded-sm object-cover" />
            ) : (
              <span className="text-2xl">🏆</span>
            )}
          </div>
          <div className="text-center">
            <p className="font-display text-lg uppercase tracking-wider text-foreground">
              {p2.teamName}
            </p>
            <p className="font-body text-xs text-muted-foreground">{p2.displayName}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-3xl font-bold text-money">{p2.score}</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
              POINTS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PoolPage() {
  const params = useParams();
  const router = useRouter();
  const [poolData, setPoolData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const joinCode = params.id as string;
    Promise.all([
      api.pools.get(joinCode),
      api.pools.leaderboard(joinCode).catch(() => null),
    ])
      .then(([poolRes, lbRes]) => {
        setPoolData(poolRes);
        setLeaderboard(lbRes?.leaderboard || []);
      })
      .catch(() => setError("Pool not found"))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="relative flex min-h-dvh flex-col">
        <TopNav title="Pool" showBack backHref="/pools" />
        <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-12">
          <p className="font-mono text-[11px] text-muted-foreground/40">Loading pool...</p>
        </main>
      </div>
    );
  }

  if (error || !poolData) {
    return (
      <div className="relative flex min-h-dvh flex-col">
        <TopNav title="Pool" showBack backHref="/pools" />
        <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-12">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <AlertCircle className="h-8 w-8 text-primary" />
              <p className="font-display text-sm uppercase tracking-wider text-foreground">{error || "Pool not found"}</p>
              <Button size="sm" onClick={() => router.push("/")}>Create a pool</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const { pool, memberCount, spotsRemaining } = poolData;
  const participants = leaderboard;
  const isSingleScope = pool.scope === "single";
  const isCustomScope = pool.scope === "custom";

  return (
    <div className="relative flex min-h-dvh flex-col">
      <TopNav
        title={pool.name}
        showBack
        backHref="/pools"
        right={<ShareButton poolId={pool.joinCode} />}
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
              <h1 className="font-display text-2xl uppercase tracking-tight text-foreground sm:text-3xl">
                {pool.name}
              </h1>
              <div className="mt-1 flex items-center gap-3">
                <LiveIndicator label={poolStatusLabel(pool.status)} />
                <Badge variant="elevated" size="sm">{memberCount ?? participants.length} players</Badge>
                <Badge variant="outline" size="sm">
                  {pool.isPrivate ? (
                    <><EyeOff className="h-2.5 w-2.5" /> Private</>
                  ) : (
                    <><Globe className="h-2.5 w-2.5" /> Public</>
                  )}
                </Badge>
                {pool.scope && pool.scope !== "all" && (
                  <Badge variant="outline" size="sm">
                    <Swords className="h-2.5 w-2.5" />
                    {pool.scope === "single" ? "1 Match" : "Custom"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {poolCanJoin(pool.status) && (
              <Button variant="primary" size="sm" onClick={() => router.push(`/join/${pool.joinCode}`)}>
                <Sparkles className="h-3.5 w-3.5" />
                Join Pool
              </Button>
            )}
          </div>
        </motion.div>

        {/* Escrow status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <EscrowStatus
            totalPot={pool.entryFeeUsdc * (memberCount ?? participants.length)}
            participantCount={memberCount ?? participants.length}
            entryFee={pool.entryFeeUsdc}
            status={pool.status === "settled" ? "settled" : "locked"}
            fee={0.025}
          />
        </motion.div>

        {/* Join URL share card */}
        {poolCanJoin(pool.status) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-3">
                <ShareButton poolId={pool.joinCode || (params.id as string)} />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
                  Share
                </span>
              </div>
              {spotsRemaining !== undefined && (
                <span className="font-mono text-[10px] text-muted-foreground/40">
                  {spotsRemaining} spot{spotsRemaining !== 1 ? "s" : ""} remaining
                </span>
              )}
            </div>
          </motion.div>
        )}

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
                  <span className="font-display text-sm uppercase tracking-wider text-foreground">
                    {isSingleScope ? "Battle" : "Leaderboard"}
                  </span>
                </div>
                <LiveIndicator label={poolStatusLabel(pool.status)} />
              </div>
              {!isSingleScope && <LeaderboardHeader />}
            </CardHeader>
            <CardContent className="p-0">
              {participants.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <p className="font-body text-sm text-muted-foreground/40">No participants yet</p>
                  {poolCanJoin(pool.status) && (
                    <Button size="sm" variant="secondary" onClick={() => router.push(`/join/${pool.joinCode || params.id}`)}>
                      Join this pool
                    </Button>
                  )}
                </div>
              ) : isSingleScope ? (
                <div className="px-5 py-6">
                  <BattleCard participants={participants} />
                </div>
              ) : (
                participants.map((participant: any) => (
                  <motion.div
                    key={participant.memberId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + (participant.rank - 1) * 0.05, duration: 0.3 }}
                  >
                    <LeaderboardRow
                      participant={{
                        id: participant.memberId,
                        name: participant.displayName,
                        walletAddress: participant.wallet,
                        team: {
                          name: participant.teamName || "",
                          flag: participant.teamFlagUrl || "",
                          group: participant.teamGroup || "",
                        },
                        score: participant.score || 0,
                        rank: participant.rank,
                      }}
                      rank={participant.rank}
                    />
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
