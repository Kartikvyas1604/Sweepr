"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TeamAssignment } from "@/components/ui/team-assignment";
import { LiveIndicator } from "@/components/ui/live-indicator";
import { useCountdown } from "@/hooks/use-countdown";
import type { Team } from "@/lib/types";
import { Users, DollarSign, ArrowLeft, Check } from "lucide-react";

const MOCK_POOL = {
  name: "Office Cup 26",
  entryFee: 10,
  totalPot: 160,
  participantCount: 12,
  expiresAt: new Date("2026-07-19"),
  status: "open" as const,
};

export default function JoinPage() {
  const params = useParams();
  const [step, setStep] = useState<"name" | "draw" | "confirm">("name");
  const [name, setName] = useState("");
  const [assignedTeam, setAssignedTeam] = useState<Team | null>(null);
  const countdown = useCountdown(MOCK_POOL.expiresAt);

  const pool = MOCK_POOL;

  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* Back link */}
      <div className="relative z-10 border-b border-chalk/8 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-chalk-muted transition-colors hover:text-chalk">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <span className="font-display text-sm uppercase tracking-widest text-chalk">
            Sweepr
          </span>
        </div>
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
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
                        <p className="font-display text-lg uppercase tracking-wider text-chalk">
                          {pool.name}
                        </p>
                        <p className="font-mono text-[10px] text-chalk-muted/40">
                          Join the pool
                        </p>
                      </div>
                      <LiveIndicator label="OPEN" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-6">
                    {/* Pool stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center gap-1 rounded-md bg-chalk/5 px-3 py-3">
                        <DollarSign className="h-4 w-4 text-escrow" />
                        <span className="font-mono text-sm font-medium text-chalk">
                          {pool.entryFee}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-chalk-muted/40">
                          Buy-in
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-md bg-chalk/5 px-3 py-3">
                        <Users className="h-4 w-4 text-flare" />
                        <span className="font-mono text-sm font-medium text-chalk">
                          {pool.participantCount}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-chalk-muted/40">
                          In
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-md bg-chalk/5 px-3 py-3">
                        <span className="font-mono text-[11px] font-medium tracking-wider text-goalnet">
                          {countdown.days}d
                        </span>
                        <div className="flex gap-1 font-mono text-[11px] font-medium text-goalnet">
                          <span>{String(countdown.hours).padStart(2, "0")}h</span>
                          <span>{String(countdown.minutes).padStart(2, "0")}m</span>
                        </div>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-chalk-muted/40">
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
                      onClick={() => setStep("draw")}
                    >
                      <Users className="h-4 w-4" />
                      Join Pool — {pool.entryFee} USDC
                    </Button>

                    <p className="text-center font-mono text-[10px] uppercase tracking-widest text-chalk-muted/30">
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
                      <p className="font-display text-sm uppercase tracking-wider text-chalk">
                        Your Draw
                      </p>
                      <Badge variant="flare" size="sm">
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
                      className="flex h-24 w-24 items-center justify-center rounded-full bg-goalnet/10"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    >
                      <span className="text-4xl">{assignedTeam.flag}</span>
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-2xl uppercase tracking-wider text-goalnet">
                        {assignedTeam.name}
                      </p>
                      <p className="mt-1 font-body text-sm text-chalk-muted">
                        You&apos;re cheering for {assignedTeam.name} this Cup.
                      </p>
                    </div>
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => {}}
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
