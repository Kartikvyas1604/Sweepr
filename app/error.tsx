"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ reset }: ErrorProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <motion.div
        className="flex flex-col items-center gap-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <AlertTriangle className="h-16 w-16 text-flare/60" />
        </motion.div>
        <div>
          <p className="font-display text-xl uppercase tracking-wider text-chalk">
            Something went wrong
          </p>
          <p className="mt-2 font-body text-sm text-chalk-muted">
            The match data couldn&apos;t load. Try again.
          </p>
        </div>
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </motion.div>
    </div>
  );
}
