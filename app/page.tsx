"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { createPool } from "@/lib/store";
import {
  ArrowRight,
  Users,
  Trophy,
  Sparkles,
  Lock,
  Share2,
  Globe,
  EyeOff,
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
  const [isPrivate, setIsPrivate] = useState(false);
  const [passphrase, setPassphrase] = useState("");

  function handleCreate() {
    const fee = parseFloat(entryFee);
    if (!poolName || !fee) return;
    const pool = createPool(
      poolName,
      fee,
      isPrivate,
      isPrivate ? passphrase : undefined,
    );
    router.push(`/pool/${pool.id}`);
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* Top ticker bar */}
      <div className="relative z-10 flex h-8 items-center overflow-hidden border-b border-hairline bg-panel/60 px-4">
        <div className="flex w-full items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted/60">
          <span className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
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
              <div className="inline-flex items-center gap-3 rounded-full border border-hairline bg-elevated/50 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted">
                <Sparkles className="h-3 w-3 text-accent" />
                on-chain • trustless • instant
              </div>
            </motion.div>

            <motion.div variants={STAGGER} custom={1} className="flex flex-col items-center gap-2">
              <h1 className="font-display text-7xl leading-none tracking-tight text-ink sm:text-8xl md:text-9xl">
                SWEEPR
              </h1>
              <p className="max-w-lg font-body text-base leading-relaxed text-ink-muted sm:text-lg">
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
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-elevated bg-panel text-[10px] font-bold text-ink-muted"
                  >
                    {["🇧🇷", "🇦🇷", "🇫🇷", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"][i]}
                  </div>
                ))}
              </div>
              <span className="font-mono text-[11px] text-ink-muted">
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
                <div className="flex items-center gap-2 font-display text-sm uppercase tracking-wider text-ink">
                  <Trophy className="h-4 w-4 text-money" />
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

                {/* Public / Private toggle */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsPrivate(false); setPassphrase(""); }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider transition-all ${
                      !isPrivate
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-hairline bg-elevated/30 text-ink-muted/50 hover:border-ink-muted/30"
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2.5 font-mono text-[11px] uppercase tracking-wider transition-all ${
                      isPrivate
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-hairline bg-elevated/30 text-ink-muted/50 hover:border-ink-muted/30"
                    }`}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Private
                  </button>
                </div>

                {isPrivate && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Input
                      id="passphrase"
                      label="Passphrase"
                      placeholder="e.g. thunder-falcon-42"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                    />
                  </motion.div>
                )}

                <Button
                  size="lg"
                  className="w-full"
                  disabled={!poolName || !entryFee || (isPrivate && !passphrase)}
                  onClick={handleCreate}
                >
                  Create Pool
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <p className="text-center font-mono text-[10px] uppercase tracking-widest text-ink-muted/40">
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated/50">
                      <step.icon className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-display text-sm uppercase tracking-wider text-ink">
                        {step.label}
                      </p>
                      <p className="mt-1 font-body text-xs leading-relaxed text-ink-muted">
                        {step.desc}
                      </p>
                    </div>
                    {i < STEPS.length - 1 && (
                      <ArrowRight className="hidden h-4 w-4 text-ink-muted/30 sm:block" />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-hairline px-4 py-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <Lock className="h-3.5 w-3.5 text-money" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted/40">
              Powered by Solana · Audited
            </span>
          </div>
          <span className="font-mono text-[10px] text-ink-muted/30">
            SWEEPR © {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}
