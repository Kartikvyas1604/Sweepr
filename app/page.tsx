"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ArrowRight,
  Users,
  Trophy,
  Sparkles,
  Lock,
  Share2,
} from "lucide-react";

const STAGGER = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" as const },
  }),
};

const STEPS = [
  { icon: Users, label: "Create Pool", desc: "Set the buy-in and name your pool" },
  { icon: Share2, label: "Share Link", desc: "Friends join & get random teams" },
  { icon: Trophy, label: "Auto Settle", desc: "Smart contract pays the winner" },
];

export default function Home() {
  const router = useRouter();
  const [poolName, setPoolName] = useState("");
  const [entryFee, setEntryFee] = useState("");

  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* Top ticker bar */}
      <div className="relative z-10 flex h-8 items-center overflow-hidden border-b border-chalk/8 bg-pitch-light/60 px-4">
        <div className="flex w-full items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-muted/60">
          <span className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flare opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-flare" />
            </span>
            LIVE ODDS
          </span>
          <span className="hidden sm:block">WORLD CUP 2026 · SWEEPSTAKE SEASON</span>
          <span>POT: $--.--</span>
        </div>
      </div>

      {/* Hero */}
      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-12 sm:gap-16">
          {/* Scoreboard header */}
          <motion.div
            className="flex flex-col items-center gap-6 text-center"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.15 } },
            }}
          >
            <motion.div variants={STAGGER} custom={0}>
              <div className="inline-flex items-center gap-3 rounded-full border border-chalk/10 bg-chalk/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-chalk-muted">
                <Sparkles className="h-3 w-3 text-goalnet" />
                on-chain • trustless • instant
              </div>
            </motion.div>

            <motion.div variants={STAGGER} custom={1} className="flex flex-col items-center gap-2">
              <h1 className="font-display text-7xl leading-none tracking-tight text-chalk sm:text-8xl md:text-9xl">
                SWEEPR
              </h1>
              <p className="max-w-lg font-body text-base leading-relaxed text-chalk-muted sm:text-lg">
                Office pool, automated. Create a sweepstakes, share the link, and
                the smart contract settles the winner — no spreadsheets, no
                &ldquo;who has the cash?&rdquo; group chats.
              </p>
            </motion.div>

            <motion.div variants={STAGGER} custom={2} className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-pitch bg-pitch-light text-[10px] font-bold text-chalk-muted"
                  >
                    {["🇧🇷", "🇦🇷", "🇫🇷", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"][i]}
                  </div>
                ))}
              </div>
              <span className="font-mono text-[11px] text-chalk-muted">
                Join 1,234 active pools
              </span>
            </motion.div>
          </motion.div>

          {/* Create pool card */}
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <Card variant="elevated">
              <CardHeader>
                <div className="flex items-center gap-2 font-display text-sm uppercase tracking-wider text-chalk">
                  <Trophy className="h-4 w-4 text-goalnet" />
                  Start Your Pool
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Input
                  id="pool-name"
                  label="Pool Name"
                  placeholder="e.g. Office Cup 26"
                  value={poolName}
                  onChange={(e) => setPoolName(e.target.value)}
                />
                <Input
                  id="entry-fee"
                  label="Entry Fee (USDC)"
                  placeholder="e.g. 10"
                  type="number"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                />
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!poolName || !entryFee}
                  onClick={() => router.push("/pool/1")}
                >
                  Create Pool
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="text-center font-mono text-[10px] uppercase tracking-widest text-chalk-muted/40">
                  2.5% fee · escrow-secured · instant settlement
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* How it works */}
          <motion.div
            className="grid w-full max-w-3xl gap-4 sm:grid-cols-3"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.15, delayChildren: 0.8 },
              },
            }}
          >
            {STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <Card className="h-full text-center">
                  <CardContent className="flex flex-col items-center gap-3 py-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chalk/5">
                      <step.icon className="h-5 w-5 text-flare" />
                    </div>
                    <div>
                      <p className="font-display text-sm uppercase tracking-wider text-chalk">
                        {step.label}
                      </p>
                      <p className="mt-1 font-body text-xs leading-relaxed text-chalk-muted">
                        {step.desc}
                      </p>
                    </div>
                    {i < STEPS.length - 1 && (
                      <ArrowRight className="hidden h-4 w-4 text-chalk-muted/30 sm:block" />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-chalk/8 px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <Lock className="h-3.5 w-3.5 text-escrow" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-chalk-muted/40">
              Powered by Solana · Audited
            </span>
          </div>
          <span className="font-mono text-[10px] text-chalk-muted/30">
            SWEEPR © {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}
