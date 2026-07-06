"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Lock, Unlock, Timer, Coins } from "lucide-react";

interface EscrowStatusProps {
  totalPot: number;
  participantCount: number;
  entryFee: number;
  status: "locked" | "unlocked" | "settled";
  fee: number;
  className?: string;
}

function EscrowStatus({
  totalPot,
  participantCount,
  entryFee,
  status,
  fee,
  className,
}: EscrowStatusProps) {
  const feeAmount = totalPot * fee;

  return (
    <div
      className={cn(
        "rounded-lg border bg-panel px-4 py-3 backdrop-blur-sm",
        status === "settled"
          ? "border-success/20"
          : "border-hairline",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === "locked" && (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Lock className="h-4 w-4 text-money/70" />
            </motion.div>
          )}
          {status === "unlocked" && (
            <Unlock className="h-4 w-4 text-money" />
          )}
          {status === "settled" && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
            >
              <Coins className="h-4 w-4 text-success" />
            </motion.div>
          )}
          <span
            className={cn(
              "font-mono text-[11px] uppercase tracking-widest",
              status === "locked" && "text-money/70",
              status === "unlocked" && "text-money",
              status === "settled" && "text-success",
            )}
          >
            Escrow {status}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs tabular-nums text-ink">
          <span className="font-display text-lg tracking-tight">
            {totalPot.toLocaleString("en-US")}{" "}
            <span className="text-[10px] font-mono font-normal text-ink-muted/40">
              SOL
            </span>
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2">
        <div className="flex items-center gap-3 font-mono text-[10px] text-ink-muted/40">
          <span>
            {participantCount} × {entryFee} SOL
          </span>
          <span className="text-ink-muted/20">|</span>
          <span>
            Fee: {feeAmount.toLocaleString("en-US")} SOL ({(fee * 100).toFixed(1)}%)
          </span>
        </div>
        {status === "locked" && (
          <div className="flex items-center gap-1 font-mono text-[10px] text-money/70">
            <Timer className="h-3 w-3" />
            Auto-settle after final match
          </div>
        )}
      </div>
    </div>
  );
}

export { EscrowStatus };
