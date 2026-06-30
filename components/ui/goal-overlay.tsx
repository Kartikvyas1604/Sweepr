"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GoalOverlayProps {
  show: boolean;
  scorerName: string;
  teamFlag: string;
}

function GoalOverlay({ show, scorerName, teamFlag }: GoalOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {visible && (
            <div className="flex flex-col items-center">
              <motion.div className="flex items-center gap-4">
                <motion.div
                  className="h-px w-12 bg-accent/60"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                />
                <motion.span
                  className="font-display text-7xl uppercase tracking-[0.15em] text-white sm:text-8xl"
                  style={{
                    textShadow:
                      "0 0 20px rgba(235,86,0,0.5), 0 0 60px rgba(235,86,0,0.3)",
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
                >
                  GOAL
                </motion.span>
                <motion.div
                  className="h-px w-12 bg-accent/60"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                />
              </motion.div>

              <motion.div
                className="mt-4 flex items-center gap-3"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
              >
                <span className="text-2xl">{teamFlag}</span>
                <span className="font-body text-lg uppercase tracking-[0.2em] text-white/80">
                  {scorerName}
                </span>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { GoalOverlay };
