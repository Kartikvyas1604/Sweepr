"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/utils";
import { TopNav } from "@/components/ui/top-nav";
import {
  Trophy,
  Coins,
  ExternalLink,
  CheckCircle2,
  PartyPopper,
  Lock,
  Unlock,
} from "lucide-react";

const WINNER = {
  name: "Alex",
  team: "Brazil",
  flag: "🇧🇷",
  score: 18,
  walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
};

const TX_HASH = "5KLix1R7dVhG6qQxYq3Yq8QKq3Yq8QKq3Yq8QKq3Yq8Q";

enum Phase {
  Locked = "locked",
  Unlocking = "unlocking",
  WinnerReveal = "winner-reveal",
  PayoutConfirm = "payout-confirm",
  Complete = "complete",
}

export default function SettlePage() {
  const params = useParams();
  const [phase, setPhase] = useState<Phase>(Phase.Locked);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(Phase.Unlocking), 1000);
    const t2 = setTimeout(() => setPhase(Phase.WinnerReveal), 2500);
    const t3 = setTimeout(() => setPhase(Phase.PayoutConfirm), 4000);
    const t4 = setTimeout(() => {
      setPhase(Phase.Complete);
      setShowConfetti(true);
    }, 5500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Animated background glow during completion */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Simulated confetti particles */}
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-2 w-2 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-5%`,
                  backgroundColor: [
                    "#FF6B35",
                    "#F7D44A",
                    "#4ADE80",
                    "#4A90D9",
                    "#F0F0E8",
                  ][i % 5],
                }}
                animate={{
                  top: "105%",
                  left: `${Math.random() * 100}%`,
                  rotate: Math.random() * 720,
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
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
            {/* Phase: Locked / Escrow vault */}
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
                      <Lock className="h-16 w-16 text-escrow/60" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-xl uppercase tracking-wider text-chalk">
                        Escrow Locked
                      </p>
                      <p className="mt-2 font-body text-sm text-chalk-muted">
                        All matches have finished. The vault is unlocking to
                        determine the champion...
                      </p>
                    </div>
                    <div className="flex gap-1 font-mono text-xs text-escrow">
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

            {/* Phase: Unlocking */}
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
                      <Unlock className="h-16 w-16 text-goalnet" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-xl uppercase tracking-wider text-goalnet">
                        Vault Unlocked
                      </p>
                      <p className="mt-2 font-body text-sm text-chalk-muted">
                        The smart contract has tallied the final scores.
                        <br />
                        Preparing the winner announcement...
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Phase: Winner Reveal */}
            {phase === Phase.WinnerReveal && (
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
                      <Badge variant="goalnet" size="md">
                        <PartyPopper className="h-3 w-3" />
                        CHAMPION CROWNED
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-6 py-8">
                    <motion.div
                      className="flex h-32 w-32 items-center justify-center rounded-full bg-goalnet/10"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    >
                      <motion.span
                        className="text-5xl"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {WINNER.flag}
                      </motion.span>
                    </motion.div>
                    <motion.div
                      className="text-center"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <p className="font-display text-3xl uppercase tracking-tight text-goalnet">
                        {WINNER.name}
                      </p>
                      <p className="mt-1 font-body text-sm text-chalk-muted">
                        {WINNER.team} · {WINNER.score} points
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

            {/* Phase: Payout Confirming */}
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
                      <Coins className="h-12 w-12 text-goalnet" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-xl uppercase tracking-wider text-chalk">
                        Payout in Progress
                      </p>
                      <p className="mt-2 font-body text-sm text-chalk-muted">
                        Broadcasting settlement transaction to Solana...
                      </p>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-chalk-muted/40">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="h-3 w-3 rounded-full border-2 border-chalk-muted/20 border-t-escrow"
                      />
                      Confirming...
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Phase: Complete */}
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
                      <p className="mt-1 font-body text-sm text-chalk-muted">
                        Funds have been released to the winner.
                      </p>
                    </div>

                    {/* Payout breakdown */}
                    <div className="w-full space-y-2 rounded-lg bg-chalk/5 px-4 py-4">
                      <div className="flex items-center justify-between font-mono text-xs text-chalk-muted">
                        <span>Total Pot</span>
                        <span className="tabular-nums text-chalk">80 USDC</span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-xs text-chalk-muted">
                        <span>Sweepr Fee (2.5%)</span>
                        <span className="tabular-nums text-chalk">2 USDC</span>
                      </div>
                      <div className="border-t border-surface-border pt-2">
                        <div className="flex items-center justify-between font-mono text-sm">
                          <span className="text-success">Winner Payout</span>
                          <span className="tabular-nums font-medium text-success">
                            78 USDC
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Transaction */}
                    <div className="w-full space-y-2">
                      <div className="flex items-center justify-between rounded-md bg-chalk/5 px-4 py-2.5">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-chalk-muted/40">
                          Transaction
                        </span>
                        <a
                          href={`https://solscan.io/tx/${TX_HASH}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 font-mono text-xs text-escrow transition-colors hover:text-escrow/80"
                        >
                          {formatAddress(TX_HASH)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="flex items-center justify-between rounded-md bg-chalk/5 px-4 py-2.5">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-chalk-muted/40">
                          Winner
                        </span>
                        <span className="font-mono text-xs text-chalk">
                          {WINNER.name} · {formatAddress(WINNER.walletAddress)}
                        </span>
                      </div>
                    </div>

                    <Button size="lg" className="w-full" variant="primary">
                      View Pool Recap
                      <ArrowLeft className="h-4 w-4 rotate-180" />
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
