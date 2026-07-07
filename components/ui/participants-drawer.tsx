"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Participant } from "@/lib/types";
import { Users, X } from "lucide-react";

interface ParticipantsDrawerProps {
  participants: Participant[];
  isOpen: boolean;
  onClose: () => void;
}

function ParticipantsDrawer({
  participants,
  isOpen,
  onClose,
}: ParticipantsDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Drawer */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] rounded-t-xl border-t border bg-background px-4 pb-8 pt-4 shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-display text-sm uppercase tracking-wider text-foreground">
                  Participants ({participants.length})
                </span>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-1">
              {participants.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-muted/30"
                >
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground/40 w-6">
                    {i + 1}
                  </span>
                  <span className="text-base">{p.team.flag}</span>
                  <span className="flex-1 font-body text-sm text-foreground">
                    {p.name}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/40">
                    {p.team.name}
                  </span>
                  <span className="font-display text-base tabular-nums text-muted-foreground w-8 text-right">
                    {p.score}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export { ParticipantsDrawer };
