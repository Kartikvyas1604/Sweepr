"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Wallet, CheckCircle2 } from "lucide-react";

interface WalletButtonProps {
  className?: string;
}

function WalletButton({ className }: WalletButtonProps) {
  const [connected, setConnected] = useState(false);

  return (
    <button
      onClick={() => setConnected(!connected)}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all duration-200",
        connected
          ? "border-success/20 bg-success/5 text-success hover:bg-success/10"
          : "border-chalk/10 text-chalk-muted hover:border-chalk/20 hover:text-chalk",
        className,
      )}
    >
      {connected ? (
        <>
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </motion.span>
          0x12...34
        </>
      ) : (
        <>
          <Wallet className="h-3.5 w-3.5" />
          Connect
        </>
      )}
    </button>
  );
}

export { WalletButton };
