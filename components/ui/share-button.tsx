"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";

interface ShareButtonProps {
  poolId: string;
  className?: string;
}

function ShareButton({ poolId, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const link = `${window.location.origin}/join/${poolId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [poolId]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "relative flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider transition-colors",
        copied ? "text-success" : "text-chalk-muted hover:text-chalk",
        className,
      )}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Copied!
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="flex items-center gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Join Link
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export { ShareButton };
