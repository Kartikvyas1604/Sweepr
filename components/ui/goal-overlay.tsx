"use client";

import { motion, AnimatePresence } from "framer-motion";

interface GoalOverlayProps {
  show: boolean;
  scorerName: string;
  teamFlag: string;
}

function GoalOverlay({ show, scorerName, teamFlag }: GoalOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Flash layer */}
          <motion.div
            className="absolute inset-0 bg-accent/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          />

          {/* Goal text */}
          <motion.div
            className="relative flex flex-col items-center gap-2"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            <motion.span
              className="font-display text-8xl uppercase tracking-tight text-accent drop-shadow-[0_0_40px_rgba(235,86,0,0.5)] sm:text-9xl"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 0.3, repeat: 2 }}
            >
              GOAL!
            </motion.span>
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="text-2xl">{teamFlag}</span>
              <span className="font-display text-xl uppercase tracking-wider text-ink">
                {scorerName}
              </span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { GoalOverlay };
