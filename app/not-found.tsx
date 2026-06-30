"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <motion.div
        className="flex flex-col items-center gap-6 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.span
          className="font-display text-8xl tabular-nums text-chalk-muted/20 sm:text-9xl"
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          404
        </motion.span>
        <div>
          <p className="font-display text-xl uppercase tracking-wider text-chalk">
            No pitch found
          </p>
          <p className="mt-2 font-body text-sm text-chalk-muted">
            This pool doesn&apos;t exist — or the link expired.
          </p>
        </div>
        <Button onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Button>
      </motion.div>
    </div>
  );
}
