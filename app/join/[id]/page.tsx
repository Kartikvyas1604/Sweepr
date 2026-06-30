"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TeamAssignment } from "@/components/ui/team-assignment";
import { LiveIndicator } from "@/components/ui/live-indicator";
import { useCountdown } from "@/hooks/use-countdown";
import { getPool, joinPool } from "@/lib/store";
import type { Team, Pool } from "@/lib/types";
import { TopNav } from "@/components/ui/top-nav";
import { Users, DollarSign, Check, EyeOff, Globe, AlertCircle } from "lucide-react";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"passphrase" | "name" | "draw" | "confirm">("name");
  const [name, setName] = useState("");
  const [passphraseInput, setPassphraseInput] = useState("");
  const [passphraseError, setPassphraseError] = useState(false);
  const [assignedTeam, setAssignedTeam] = useState<Team | null>(null);
  const countdown = useCountdown(pool?.expiresAt ?? new Date());

  useEffect(() => {
    const p = getPool(params.id as string);
    if (p) {
      setPool(p);
      setStep(p.isPrivate ? "passphrase" : "name");
    }
    setLoading(false);
  }, [params.id]);

  if (loading) {
    return (
      <div className="relative flex min-h-dvh flex-col">
        <TopNav title="Join Pool" showBack />
        <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
          <p className="font-mono text-[11px] text-ink-muted/40">Loading pool...</p>
        </main>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="relative flex min-h-dvh flex-col">
        <TopNav title="Join Pool" showBack />
        <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
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

  function handleVerifyPassphrase() {
    if (!pool) return;
    if (passphraseInput.trim() === pool.passphrase) {
      setPassphraseError(false);
      setStep("name");
    } else {
      setPassphraseError(true);
    }
  }

  function handleJoin() {
    const participant = joinPool(params.id as string, name.trim(), `0x${Math.random().toString(36).slice(2, 10)}`);
    if (participant) {
      setAssignedTeam(participant.team);
      setStep("draw");
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <TopNav title="Join Pool" showBack />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {step === "passphrase" && (
              <motion.div
                key="passphrase"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex w-full items-center justify-between">
                      <div>
                        <p className="font-display text-lg uppercase tracking-wider text-ink">
                          {pool.name}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-ink-muted/40">
                          <EyeOff className="h-3 w-3 text-accent" />
                          Private pool — passphrase required
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-6">
                    <Input
                      id="passphrase"
                      label="Passphrase"
                      placeholder="Enter the pool passphrase"
                      value={passphraseInput}
                      onChange={(e) => { setPassphraseInput(e.target.value); setPassphraseError(false); }}
                      error={passphraseError ? "Incorrect passphrase" : undefined}
                    />
                    <Button
                      size="lg"
                      className="w-full"
                      disabled={!passphraseInput.trim()}
                      onClick={handleVerifyPassphrase}
                    >
                      <EyeOff className="h-4 w-4" />
                      Verify & Join
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "name" && (
              <motion.div
                key="name"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex w-full items-center justify-between">
                      <div>
                        <p className="font-display text-lg uppercase tracking-wider text-ink">
                          {pool.name}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-ink-muted/40">
                          {pool.isPrivate ? (
                            <><EyeOff className="h-3 w-3 text-accent" /> Private</>
                          ) : (
                            <><Globe className="h-3 w-3 text-ink-muted" /> Public</>
                          )}
                        </p>
                      </div>
                      <LiveIndicator label="OPEN" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-6">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center gap-1 rounded-md bg-elevated/30 px-3 py-3">
                        <DollarSign className="h-4 w-4 text-money" />
                        <span className="font-mono text-sm font-medium text-ink">
                          {pool.entryFee}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-ink-muted/40">
                          Buy-in
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-md bg-elevated/30 px-3 py-3">
                        <Users className="h-4 w-4 text-ink-muted" />
                        <span className="font-mono text-sm font-medium text-ink">
                          {pool.participantCount}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-ink-muted/40">
                          In
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-md bg-elevated/30 px-3 py-3">
                        <span className="font-mono text-[11px] font-medium tracking-wider text-money">
                          {countdown.days}d
                        </span>
                        <div className="flex gap-1 font-mono text-[11px] font-medium text-money">
                          <span>{String(countdown.hours).padStart(2, "0")}h</span>
                          <span>{String(countdown.minutes).padStart(2, "0")}m</span>
                        </div>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-ink-muted/40">
                          Left
                        </span>
                      </div>
                    </div>

                    <Input
                      id="name"
                      label="Your Name"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />

                    <Button
                      size="lg"
                      className="w-full"
                      disabled={!name.trim()}
                      onClick={handleJoin}
                    >
                      <Users className="h-4 w-4" />
                      Join Pool — {pool.entryFee} USDC
                    </Button>

                    <p className="text-center font-mono text-[10px] uppercase tracking-widest text-ink-muted/30">
                      Entry fee held in escrow. Refunded if no matches play.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "draw" && (
              <motion.div
                key="draw"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex w-full items-center justify-between">
                      <p className="font-display text-sm uppercase tracking-wider text-ink">
                        Your Draw
                      </p>
                      <Badge variant="outline" size="sm">
                        Random
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <TeamAssignment
                      participantName={name}
                      onAssigned={(team) => {
                        setAssignedTeam(team);
                        setTimeout(() => setStep("confirm"), 2000);
                      }}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "confirm" && assignedTeam && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      <p className="font-display text-sm uppercase tracking-wider text-success">
                        You&apos;re In!
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-6 py-8">
                    <motion.div
                      className="flex h-24 w-24 items-center justify-center rounded-full bg-money/10"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    >
                      <span className="text-4xl">{assignedTeam.flag}</span>
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-2xl uppercase tracking-wider text-money">
                        {assignedTeam.name}
                      </p>
                      <p className="mt-1 font-body text-sm text-ink-muted">
                        You&apos;re cheering for {assignedTeam.name} this Cup.
                      </p>
                    </div>
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => router.push(`/pool/${params.id}`)}
                    >
                      View Leaderboard
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
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
