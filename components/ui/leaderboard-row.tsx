"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/types";

interface LeaderboardRowProps {
  participant: Participant;
  rank: number;
  isCurrentUser?: boolean;
  highlight?: boolean;
}

function LeaderboardRow({
  participant,
  rank,
  isCurrentUser,
  highlight,
}: LeaderboardRowProps) {
  const [scoreChanged, setScoreChanged] = useState(false);
  const prevScoreRef = useRef(participant.score);

  useEffect(() => {
    if (prevScoreRef.current !== participant.score) {
      setScoreChanged(true);
      prevScoreRef.current = participant.score;
      const timer = setTimeout(() => setScoreChanged(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [participant.score]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: 1,
        x: 0,
        backgroundColor: highlight
          ? "rgba(255, 90, 31, 0.08)"
          : scoreChanged
            ? "rgba(242, 201, 76, 0.08)"
            : "rgba(0,0,0,0)",
      }}
      transition={{
        layout: { type: "spring", stiffness: 200, damping: 25 },
        backgroundColor: { duration: 0.3 },
      }}
      className={cn(
        "group flex items-center gap-3 border-b border px-4 py-3 transition-colors sm:px-6",
        isCurrentUser && "bg-primary/5",
        highlight && "bg-primary/5",
      )}
    >
      {/* Rank */}
      <div className="flex w-8 items-center justify-center">
        {rank <= 3 ? (
          <span
            className={cn(
              "font-display text-lg",
              rank === 1 && "text-money",
              rank === 2 && "text-muted-foreground",
              rank === 3 && "text-primary/70",
            )}
          >
            {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
          </span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground/40">
            {rank}
          </span>
        )}
      </div>

      {/* Flag + Name */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {participant.team.flag?.startsWith("http") ? (
          <img src={participant.team.flag} alt="" className="h-6 w-8 rounded-sm object-cover" />
        ) : (
          <span className="text-lg">{participant.team.flag || "🏳️"}</span>
        )}
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-body text-sm font-medium",
              isCurrentUser
                ? "text-primary"
                : rank <= 3
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {participant.name}
            {isCurrentUser && (
              <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-primary/60">
                (you)
              </span>
            )}
          </p>
          <p className="truncate font-mono text-[10px] text-muted-foreground/30">
            {participant.team.name}
          </p>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait">
          {scoreChanged ? (
            <motion.div
              key={participant.score}
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="relative"
            >
              <span className="font-display text-2xl tabular-nums tracking-tight text-money">
                {participant.score}
              </span>
              <motion.span
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="absolute -right-3 -top-0 font-display text-[10px] text-money"
              >
                +1
              </motion.span>
            </motion.div>
          ) : (
            <motion.span
              key="score"
              className="font-display text-2xl tabular-nums tracking-tight text-foreground"
            >
              {participant.score}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function LeaderboardHeader() {
  return (
    <div className="flex items-center gap-3 border-b border px-4 py-2 sm:px-6">
      <div className="w-8" />
      <div className="flex-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">
          Participant
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40">
          Pts
        </span>
      </div>
    </div>
  );
}

export { LeaderboardRow, LeaderboardHeader };
