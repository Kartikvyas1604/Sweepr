"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/utils";
import { TopNav } from "@/components/ui/top-nav";
import { getPoolWithParticipants, settlePool } from "@/lib/store";
import {
  Coins,
  ExternalLink,
  CheckCircle2,
  PartyPopper,
  Lock,
  Unlock,
  ArrowRight,
} from "lucide-react";

enum Phase {
  Locked = "locked",
  Unlocking = "unlocking",
  WinnerReveal = "winner-reveal",
  PayoutConfirm = "payout-confirm",
  Complete = "complete",
}

export default function SettlePage() {
  const params = useParams();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(Phase.Locked);
  const [showConfetti, setShowConfetti] = useState(false);
  const [settled, setSettled] = useState(false);

  const { pool, participants } = getPoolWithParticipants(params.id as string);
  const sorted = useMemo(
    () => [...participants].sort((a, b) => b.score - a.score),
    [participants],
  );
  const winner = sorted[0];

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(Phase.Unlocking), 1000);
    const t2 = setTimeout(() => setPhase(Phase.WinnerReveal), 2500);
    const t3 = setTimeout(() => setPhase(Phase.PayoutConfirm), 4000);
    const t4 = setTimeout(() => {
      setPhase(Phase.Complete);
      setShowConfetti(true);
      if (!settled) {
        settlePool(params.id as string);
        setSettled(true);
      }
    }, 5500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [params.id, settled]);

  const confettiParticles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: `${(i * 3.7 + 13) % 100}%`,
        color: ["#FF5A1F", "#F2C94C", "#34D399", "#8FA396", "#F4F1E8"][i % 5],
        targetLeft: `${(i * 7.1 + 42) % 100}%`,
        rotate: (i * 37 + 180) % 720,
        duration: 3 + (i % 5) * 0.4,
        delay: (i * 0.07) % 2,
      })),
    [],
  );

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {confettiParticles.map((p) => (
              <motion.div
                key={p.id}
                className="absolute h-2 w-2 rounded-sm"
                style={{
                  left: p.left,
                  top: "-5%",
                  backgroundColor: p.color,
                }}
                animate={{
                  top: "105%",
                  left: p.targetLeft,
                  rotate: p.rotate,
                }}
                transition={{
                  duration: p.duration,
                  repeat: Infinity,
                  delay: p.delay,
                  ease: "linear",
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <TopNav title="Settlement" showBack backHref={`/pool/${params.id}`} />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {phase === Phase.Locked && (
              <motion.div
                key="locked"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center gap-6 py-12">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Lock className="h-16 w-16 text-money/60" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-xl uppercase tracking-wider text-foreground">
                        Escrow Locked
                      </p>
                      <p className="mt-2 font-body text-sm text-muted-foreground">
                        All matches have finished. The vault is unlocking to
                        determine the champion...
                      </p>
                    </div>
                    <div className="flex gap-1 font-mono text-xs text-money">
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        PROCESSING
                      </motion.span>
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                      >
                        ·
                      </motion.span>
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                      >
                        VERIFYING
                      </motion.span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {phase === Phase.Unlocking && (
              <motion.div
                key="unlocking"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center gap-6 py-12">
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <Unlock className="h-16 w-16 text-money" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-xl uppercase tracking-wider text-money">
                        Vault Unlocked
                      </p>
                      <p className="mt-2 font-body text-sm text-ink-muted">
                        The smart contract has tallied the final scores.
                        <br />
                        Preparing the winner announcement...
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {phase === Phase.WinnerReveal && winner && (
              <motion.div
                key="winner"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 150, damping: 15 }}
              >
                <Card variant="bordered">
                  <CardHeader>
                    <div className="flex w-full items-center justify-center">
                      <Badge variant="money" size="md">
                        <PartyPopper className="h-3 w-3" />
                        CHAMPION CROWNED
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-6 py-8">
                    <motion.div
                      className="flex h-32 w-32 items-center justify-center rounded-full bg-money/10"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    >
                      <motion.span
                        className="text-5xl"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {winner.team.flag}
                      </motion.span>
                    </motion.div>
                    <motion.div
                      className="text-center"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <p className="font-display text-3xl uppercase tracking-tight text-money">
                        {winner.name}
                      </p>
                      <p className="mt-1 font-body text-sm text-ink-muted">
                        {winner.team.name} · {winner.score} points
                      </p>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <Button size="lg" disabled>
                        <Coins className="h-4 w-4" />
                        Releasing Funds...
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {phase === Phase.PayoutConfirm && (
              <motion.div
                key="confirming"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center gap-6 py-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    >
                      <Coins className="h-12 w-12 text-money" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-xl uppercase tracking-wider text-foreground">
                        Payout in Progress
                      </p>
                      <p className="mt-2 font-body text-sm text-muted-foreground">
                        Broadcasting settlement transaction to Solana...
                      </p>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground/40">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="h-3 w-3 rounded-full border-2 border-ink-muted/20 border-t-money"
                      />
                      Confirming...
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {phase === Phase.Complete && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 150, damping: 15 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center gap-6 py-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 12,
                        delay: 0.1,
                      }}
                    >
                      <CheckCircle2 className="h-16 w-16 text-success" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-2xl uppercase tracking-tight text-success">
                        Settled!
                      </p>
                      <p className="mt-1 font-body text-sm text-ink-muted">
                        Funds have been released to the winner.
                      </p>
                    </div>

                    <div className="w-full space-y-2 rounded-lg bg-muted/30 px-4 py-4">
                      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                        <span>Total Pot</span>
                        <span className="tabular-nums text-foreground">{pool?.totalPot ?? 0} SOL</span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                        <span>Sweepr Fee (2.5%)</span>
                        <span className="tabular-nums text-foreground">
                          {((pool?.totalPot ?? 0) * 0.025).toFixed(2)} SOL
                        </span>
                      </div>
                      <div className="border-t pt-2">
                        <div className="flex items-center justify-between font-mono text-sm">
                          <span className="text-success">Winner Payout</span>
                          <span className="tabular-nums font-medium text-success">
                            {((pool?.totalPot ?? 0) * 0.975).toFixed(2)} SOL
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full space-y-2">
                      <div className="flex items-center justify-between rounded-md bg-muted/30 px-4 py-2.5">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted/40">
                          Transaction
                        </span>
                        <span className="flex items-center gap-1.5 font-mono text-xs text-accent">
                          {formatAddress("5KLix1R7dVhG6qQxYq3Yq8QKq3Yq8QKq3Yq8QKq3Yq8Q")}
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-muted/30 px-4 py-2.5">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40">
                          Winner
                        </span>
                        <span className="font-mono text-xs text-foreground">
                          {winner?.name} · {winner ? formatAddress(winner.walletAddress) : ""}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="lg"
                      className="w-full"
                      variant="primary"
                      onClick={() => router.push(`/dashboard`)}
                    >
                      View Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
