"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/ui/top-nav";
import { WalletButton } from "@/components/ui/wallet-button";
import { useWallet } from "@/components/wallet-provider";
import { api } from "@/lib/api-client";
import {
  Plus,
  Trophy,
  Users,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Medal,
  Search,
  Sparkles,
  Filter,
} from "lucide-react";

interface PoolCardProps {
  pool: any;
  userAddress: string;
  isPast: boolean;
  index: number;
  onClick: () => void;
}

function PoolCard({ pool, userAddress, isPast, index, onClick }: PoolCardProps) {
  const isWinner = isPast && pool.winnerWallet === userAddress;

  const team = pool.myTeam;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: "easeOut" }}
      layout
    >
      <Card
        className="group cursor-pointer overflow-hidden transition-all duration-200 hover:border-primary/20 hover:bg-muted/20"
        onClick={onClick}
      >
        <CardContent className="flex items-center gap-4 py-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted/50">
            <span className="text-xl">{team?.teamFlagUrl ?? "🏳️"}</span>
            {isWinner && (
              <motion.div
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-money"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 12 }}
              >
                <Trophy className="h-3 w-3 text-base" />
              </motion.div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="truncate font-display text-sm font-semibold tracking-tight text-foreground">
                {pool.name}
              </span>
              {isPast ? (
                <Badge variant="elevated" size="sm">Settled</Badge>
              ) : (
                <Badge variant="live" size="sm">Active</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground/60">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {pool.memberCount}
              </span>
              <span className="tabular-nums">{Number(pool.totalStakedUsdc).toLocaleString()} SOL</span>
              <span className="tabular-nums">{pool.entryFeeUsdc} SOL entry</span>
              {team && (
                <span className="flex items-center gap-1">
                  <Medal className="h-3 w-3" />
                  #{team.rank}
                </span>
              )}
            </div>

          </div>

          {isWinner && (
            <div className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg border border-money/20 bg-money/5 px-3 py-2">
              <Trophy className="h-5 w-5 text-money" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-money/80">
                Winner
              </span>
            </div>
          )}

          {isPast && team && !isWinner && (
            <div className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg border bg-muted/30 px-3 py-2">
              <span className="font-display text-lg leading-none text-muted-foreground/60">
                #{team.rank}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/30">
                {team.score} pts
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      className="flex flex-1 flex-col gap-1.5 rounded-xl border bg-card/60 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:border-primary/10 hover:bg-muted/30"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3" style={{ color }} />
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: `${color}99` }}>
          {label}
        </span>
      </div>
      <span
        className="font-display text-2xl tracking-tight tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
    </motion.div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { connected, address } = useWallet();
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "past">("active");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    if (address) {
      api.pools.list(address).then((data) => {
        setPools(data.pools);
      }).catch(() => {
        setPools([]);
      }).finally(() => setLoading(false));
    } else {
      setPools([]);
      setLoading(false);
    }
  }, [address]);

  const { current, past, stats } = useMemo(() => {
    const current = pools.filter((p: any) => p.status !== "settled");
    const past = pools.filter((p: any) => p.status === "settled");
    const wins = past.filter((p: any) => p.winnerWallet === address);
    let best = Infinity;
    for (const p of pools) {
      const rank = p.myTeam?.rank;
      if (rank && rank > 0 && rank < best) {
        best = rank;
      }
    }
    return {
      current,
      past,
      stats: {
        total: pools.length,
        active: current.length,
        wins: wins.length,
        bestRank: best === Infinity ? "-" : `#${best}`,
      },
    };
  }, [pools, address]);

  const filteredPools = useMemo(() => {
    const source = tab === "active" ? current : past;
    if (!search) return source;
    const q = search.toLowerCase();
    return source.filter(
      (p: any) =>
        p.name.toLowerCase().includes(q) ||
        p.joinCode.toLowerCase().includes(q),
    );
  }, [current, past, tab, search]);

  if (!connected) {
    return (
      <div className="relative flex min-h-dvh flex-col">
        <TopNav
          title="Dashboard"
          right={<WalletButton />}
          onLogoClick={() => router.push("/")}
        />
        <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-8">
          <motion.div
            className="flex flex-col items-center gap-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-money/10 ring-1 ring-primary/20">
                <Wallet className="h-10 w-10 text-primary" />
              </div>
              <motion.div
                className="absolute -inset-4 rounded-3xl bg-primary/5"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              />
            </div>
            <div className="text-center">
              <h1 className="font-display text-2xl uppercase tracking-tight text-foreground">
                Connect Your Wallet
              </h1>
              <p className="mt-3 max-w-sm font-body text-sm leading-relaxed text-muted-foreground">
                Connect your Solana wallet to track your pools, view standings,
                and settle your sweepstakes.
              </p>
            </div>
            <WalletButton className="scale-110" />
            <div className="flex gap-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/30">
              <span>Phantom</span>
              <span>Backpack</span>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <TopNav
        title="Dashboard"
        right={<WalletButton />}
        onLogoClick={() => router.push("/")}
      />

      <div className="pointer-events-none fixed inset-0 top-0 z-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/3 blur-[120px]" />
        <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-money/2 blur-[100px]" />
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl uppercase tracking-tight text-foreground">
                Your Pools
              </h1>
              <p className="mt-0.5 font-body text-sm text-muted-foreground/60">
                {stats.total} pool{stats.total !== 1 ? "s" : ""} · {stats.wins} win{stats.wins !== 1 ? "s" : ""}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => router.push("/")}
            >
              <Plus className="h-4 w-4" />
              New Pool
            </Button>
          </div>
        </motion.div>

        {current.length > 0 && (
          <motion.div
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <StatCard icon={Trophy} label="Total" value={stats.total} color="#F4F1E8" delay={0.12} />
            <StatCard icon={TrendingUp} label="Active" value={stats.active} color="#FF5A1F" delay={0.16} />
            <StatCard icon={CheckCircle2} label="Wins" value={stats.wins} color="#34D399" delay={0.2} />
            <StatCard icon={Medal} label="Best" value={stats.bestRank} color="#F2C94C" delay={0.24} />
          </motion.div>
        )}

        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col items-center justify-center gap-4 py-16"
          >
            <p className="font-mono text-[11px] text-muted-foreground/40">Loading your pools...</p>
          </motion.div>
        ) : pools.length === 0 ? (
          <motion.div
            className="flex flex-1 flex-col items-center justify-center gap-6 py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-money/5 ring-1 ring-primary/10">
              <Sparkles className="h-8 w-8 text-primary/60" />
            </div>
            <div className="text-center">
              <h2 className="font-display text-lg uppercase tracking-tight text-foreground">
                No pools yet
              </h2>
              <p className="mt-2 max-w-xs font-body text-sm leading-relaxed text-muted-foreground/60">
                Start a sweepstakes with friends or join one with a shareable link.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => router.push("/")}>
                <Plus className="h-4 w-4" />
                Create Pool
              </Button>
              <Button variant="ghost" onClick={() => router.push("/pools")}>
                Browse Pools
              </Button>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <div className="flex gap-1 rounded-lg border bg-muted/20 p-0.5">
                {(["active", "past"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all duration-200 ${
                      tab === t
                        ? "bg-primary text-base shadow-sm"
                        : "text-muted-foreground/60 hover:text-foreground"
                    }`}
                  >
                    {t}
                    <span className="ml-1.5 rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] tabular-nums">
                      {t === "active" ? current.length : past.length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative ml-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
                <input
                  type="text"
                  placeholder="Search pools..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-40 rounded-lg border bg-muted/20 py-1.5 pl-8 pr-3 font-mono text-[11px] text-foreground placeholder-muted-foreground/30 outline-none transition-all focus:border-primary/30 focus:bg-muted/40 sm:w-52"
                />
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              {filteredPools.length === 0 ? (
                <motion.div
                  key="empty"
                  className="flex flex-col items-center gap-4 py-16"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/30">
                    <Filter className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <p className="font-body text-sm text-muted-foreground/40">
                    No {tab} pools match your search
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key={tab}
                  className="flex flex-col gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {filteredPools.map((pool, i) => (
                    <PoolCard
                      key={pool.id}
                      pool={pool}
                      userAddress={address!}
                      isPast={tab === "past"}
                      index={i}
                      onClick={() => router.push(`/pool/${pool.joinCode}`)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}
