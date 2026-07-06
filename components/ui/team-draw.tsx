"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface TeamDrawProps {
  participantName: string;
  drawTeams: any[];
  assignedTeam: any;
  onRevealComplete: () => void;
}

export function TeamDraw({ participantName: _pn, drawTeams, assignedTeam, onRevealComplete }: TeamDrawProps) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "revealed">("idle");
  const [currentTeam, setCurrentTeam] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startSpin() {
    setPhase("spinning");
    let count = 0;
    const maxCycles = 20 + Math.floor(Math.random() * 10);

    intervalRef.current = setInterval(() => {
      count++;
      const randomIndex = Math.floor(Math.random() * drawTeams.length);
      setCurrentTeam(drawTeams[randomIndex]);

      if (count >= maxCycles) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setCurrentTeam(assignedTeam);
        setPhase("revealed");
        setTimeout(onRevealComplete, 1200);
      }
    }, 80 + count * 3);
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div
            key="idle"
            className="flex flex-col items-center gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-dashed border-hairline">
              <span className="font-display text-4xl text-ink-muted/40">?</span>
            </div>
            <p className="text-center font-body text-sm leading-relaxed text-ink-muted">
              Tap the button to draw your team.
              <br />
              Each team is randomly assigned — no takebacks.
            </p>
            <button
              onClick={startSpin}
              className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-accent px-8 font-mono text-[11px] font-medium uppercase tracking-widest text-accent-foreground transition-all hover:bg-accent/90 active:scale-[0.97]"
            >
              <Sparkles className="h-4 w-4" />
              Draw My Team
            </button>
          </motion.div>
        )}

        {phase === "spinning" && currentTeam && (
          <motion.div
            key="spinning"
            className="flex flex-col items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex h-36 w-36 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/5"
              animate={{ scale: [1, 1.05, 1], rotate: [0, 3, -3, 0] }}
              transition={{ duration: 0.2, repeat: Infinity }}
            >
              {currentTeam.flagUrl ? (
                <img src={currentTeam.flagUrl} alt="" className="h-14 w-20 rounded-sm object-cover" />
              ) : (
                <span className="text-5xl">{currentTeam.flag || "🏳️"}</span>
              )}
            </motion.div>
            <p className="font-display text-xl uppercase tracking-wider text-accent">
              {currentTeam.name}
            </p>
            {currentTeam.group && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted/40">
                Group {currentTeam.group}
              </p>
            )}
          </motion.div>
        )}

        {phase === "revealed" && currentTeam && (
          <motion.div
            key="revealed"
            className="flex flex-col items-center gap-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <motion.div
              className="flex h-40 w-40 items-center justify-center rounded-full border-2 border-money/40 bg-money/10"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.1 }}
            >
              <motion.span
                className="text-6xl"
                initial={{ rotate: -180, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {currentTeam.flagUrl ? (
                  <img src={currentTeam.flagUrl} alt="" className="h-16 w-24 rounded-sm object-cover" />
                ) : (
                  currentTeam.flag || "🏆"
                )}
              </motion.span>
            </motion.div>
            <div className="flex flex-col items-center gap-1">
              <p className="font-display text-2xl uppercase tracking-wider text-money">
                {currentTeam.name}
              </p>
              {currentTeam.group && (
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted/40">
                  Group {currentTeam.group}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
