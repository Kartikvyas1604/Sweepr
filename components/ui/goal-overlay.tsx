"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

interface GoalOverlayProps {
  show: boolean;
  scorerName: string;
  teamFlag: string;
}

const BALL_SVG = (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
    <circle cx="50" cy="50" r="48" fill="#F5F5F5" stroke="#D0D0D0" strokeWidth="0.5" />
    <path d="M50 4 L56 20 L72 14 L66 30 L82 34 L72 48 L88 56 L72 64 L78 80 L62 74 L56 90 L50 74 L44 90 L38 74 L22 80 L28 64 L12 56 L28 48 L18 34 L34 30 L28 14 L44 20 Z" fill="#1a1a1a" />
    <path d="M50 4 L56 20 L50 28 Z" fill="#1a1a1a" />
    <path d="M56 20 L72 14 L66 30 Z" fill="#1a1a1a" />
    <path d="M72 14 L82 34 L72 48 Z" fill="#1a1a1a" />
    <path d="M82 34 L88 56 L72 64 Z" fill="#1a1a1a" />
    <path d="M88 56 L78 80 L62 74 Z" fill="#1a1a1a" />
    <path d="M78 80 L62 74 L56 90 Z" fill="#1a1a1a" />
    <path d="M56 90 L50 74 L44 90 Z" fill="#1a1a1a" />
    <path d="M44 90 L38 74 L22 80 Z" fill="#1a1a1a" />
    <path d="M22 80 L12 56 L28 48 Z" fill="#1a1a1a" />
    <path d="M12 56 L18 34 L28 48 Z" fill="#1a1a1a" />
    <path d="M18 34 L28 14 L34 30 Z" fill="#1a1a1a" />
    <path d="M28 14 L44 20 L50 28 Z" fill="#1a1a1a" />
    <path d="M44 20 L38 74 L34 30 Z" fill="#1a1a1a" />
    <path d="M66 30 L72 48 L62 74 Z" fill="#1a1a1a" />
  </svg>
);

const SHARDS = [
  { clip: "polygon(0% 0%, 30% 0%, 40% 40%, 0% 30%)", drift: { x: [-30, -80], y: [-20, -60], r: [0, 45] } },
  { clip: "polygon(30% 0%, 60% 0%, 50% 35%, 40% 40%)", drift: { x: [0, -40], y: [-20, -70], r: [0, -30] } },
  { clip: "polygon(60% 0%, 100% 0%, 100% 30%, 50% 35%)", drift: { x: [30, 80], y: [-20, -50], r: [0, 60] } },
  { clip: "polygon(0% 30%, 40% 40%, 30% 70%, 0% 60%)", drift: { x: [-20, -70], y: [0, 30], r: [0, -50] } },
  { clip: "polygon(40% 40%, 50% 35%, 65% 45%, 30% 70%)", drift: { x: [0, -20], y: [0, 40], r: [0, 25] } },
  { clip: "polygon(50% 35%, 100% 30%, 100% 60%, 65% 45%)", drift: { x: [20, 70], y: [0, 30], r: [0, -35] } },
  { clip: "polygon(0% 60%, 30% 70%, 20% 100%, 0% 100%)", drift: { x: [-15, -60], y: [20, 70], r: [0, 40] } },
  { clip: "polygon(30% 70%, 65% 45%, 70% 80%, 20% 100%)", drift: { x: [0, -30], y: [20, 60], r: [0, -55] } },
  { clip: "polygon(65% 45%, 100% 60%, 100% 100%, 70% 80%)", drift: { x: [15, 60], y: [20, 65], r: [0, 30] } },
  { clip: "polygon(20% 100%, 70% 80%, 100% 100%)", drift: { x: [0, -10], y: [30, 80], r: [0, -20] } },
];

function BallSVG() {
  return (
    <div className="h-full w-full drop-shadow-[0_0_60px_rgba(235,86,0,0.4)]">
      {BALL_SVG}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-full" />
    </div>
  );
}

function GlassShards({ onDone }: { onDone: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {SHARDS.map((shard, i) => (
        <motion.div
          key={i}
          className="absolute inset-0 bg-base"
          style={{ clipPath: shard.clip }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{
            x: shard.drift.x[1],
            y: shard.drift.y[1],
            rotate: shard.drift.r[1],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 0.8,
            delay: 0.05 * i,
            ease: [0.25, 0.46, 0.45, 0.94],
            opacity: { duration: 0.6, times: [0, 0.5, 1] },
          }}
          onAnimationComplete={i === SHARDS.length - 1 ? onDone : undefined}
        />
      ))}
    </div>
  );
}

function ShatterParticles({ show }: { show: boolean }) {
  const particles = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 60,
    y: (Math.random() - 0.5) * 60,
    size: Math.random() * 6 + 2,
    color: Math.random() > 0.35 ? "#F5F5F5" : "#1a1a1a",
    angle: Math.random() * 360,
    dist: Math.random() * 120 + 40,
    delay: Math.random() * 0.15,
  }));

  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {particles.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.dist;
            const ty = Math.sin(rad) * p.dist - 20;
            return (
              <motion.div
                key={p.id}
                className="absolute rounded-sm"
                style={{
                  left: `calc(50% + ${p.x}px)`,
                  top: `calc(50% + ${p.y}px)`,
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{ x: tx, y: ty + 80, opacity: 0, rotate: Math.random() * 720 - 360 }}
                transition={{
                  duration: 1 + Math.random() * 0.5,
                  delay: p.delay,
                  ease: [0.25, 0.46, 0.45, 0.94],
                  opacity: { duration: 0.8, ease: "easeOut" },
                }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}

function GoalOverlay({ show, scorerName, teamFlag }: GoalOverlayProps) {
  const [phase, setPhase] = useState<"idle" | "fly" | "impact" | "shatter" | "goal">("idle");
  const [side] = useState(() => Math.random() > 0.5 ? -1 : 1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) {
      setPhase("idle");
      return;
    }
    setPhase("fly");
    const t1 = setTimeout(() => setPhase("impact"), 900);
    const t2 = setTimeout(() => setPhase("shatter"), 1100);
    const t3 = setTimeout(() => setPhase("goal"), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          ref={containerRef}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          {/* Flash on impact */}
          <motion.div
            className="absolute inset-0 z-10"
            animate={{
              backgroundColor:
                phase === "impact" ? "rgba(235,86,0,0.35)" :
                phase === "shatter" ? "rgba(235,86,0,0.08)" :
                "transparent",
            }}
            transition={{ duration: 0.2 }}
          />

          {/* Screen shake wrapper */}
          <motion.div
            className="absolute inset-0 z-20"
            animate={
              phase === "impact"
                ? {
                    x: [0, -6, 6, -5, 5, -4, 4, -2, 2, -1, 1, 0],
                    y: [0, 4, -6, 3, -5, 2, -3, 1, -2, 0, 1, 0],
                    rotate: [0, -1.5, 1.5, -1, 1, -0.8, 0.8, -0.4, 0.4, -0.2, 0.2, 0],
                  }
                : { x: 0, y: 0, rotate: 0 }
            }
            transition={{
              duration: 0.7,
              ease: [0.36, 0.07, 0.19, 0.97],
            }}
          >
            {/* 3D perspective ball */}
            <motion.div
              className="absolute"
              style={{
                left: "50%",
                top: "50%",
                width: 100,
                height: 100,
                marginLeft: -50,
                marginTop: -50,
                perspective: 1000,
              }}
              initial={false}
              animate={
                phase === "fly"
                  ? {
                      x: [-side * window.innerWidth * 0.6, 0],
                      y: [60, -20],
                      width: [40, 420],
                      height: [40, 420],
                      marginLeft: [-20, -210],
                      marginTop: [-20, -210],
                      rotateX: [0, 720],
                      rotateY: [0, 540],
                      rotateZ: [0, 180],
                      scale: [1, 1],
                    }
                  : phase === "impact"
                    ? {
                        width: 420,
                        height: 420,
                        marginLeft: -210,
                        marginTop: -210,
                        scale: [1, 1.15],
                        opacity: [1, 1, 0],
                      }
                    : { width: 420, height: 420, marginLeft: -210, marginTop: -210, opacity: 0, scale: 0.5 }
              }
              transition={
                phase === "fly"
                  ? {
                      duration: 0.9,
                      ease: [0.22, 1, 0.36, 1],
                      rotateX: { duration: 0.9, ease: "linear" },
                      rotateY: { duration: 0.9, ease: "linear" },
                      rotateZ: { duration: 0.9, ease: "linear" },
                    }
                  : phase === "impact"
                    ? { scale: { duration: 0.15 }, opacity: { duration: 0.1, delay: 0.1 } }
                    : { opacity: { duration: 0.15 } }
              }
            >
              <div
                className="h-full w-full"
                style={{ transformStyle: "preserve-3d" }}
              >
                <BallSVG />
                {/* Shine overlay */}
                <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/20 via-transparent to-transparent" />
                <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_40px_rgba(0,0,0,0.2)]" />
              </div>
            </motion.div>
          </motion.div>

          {/* Glass shards */}
          {(phase === "shatter" || phase === "goal") && (
            <GlassShards onDone={() => {}} />
          )}

          {/* Particles */}
          <ShatterParticles show={phase === "shatter" || phase === "goal"} />

          {/* GOAL! text */}
          {(phase === "shatter" || phase === "goal") && (
            <motion.div
              className="relative z-50 flex flex-col items-center"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 120,
                damping: 12,
                mass: 1.2,
              }}
            >
              <motion.span
                className="font-display text-8xl uppercase tracking-tight text-accent sm:text-9xl"
                style={{
                  textShadow:
                    "0 0 30px rgba(235,86,0,0.7), 0 0 70px rgba(235,86,0,0.4), 0 0 110px rgba(235,86,0,0.2)",
                  WebkitTextStroke: "1px rgba(255,255,255,0.1)",
                }}
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 0.8, ease: "easeInOut" }}
              >
                GOAL!
              </motion.span>

              <motion.div
                className="flex items-center gap-3 mt-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
              >
                <motion.span
                  className="text-3xl"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 0.5 }}
                >
                  {teamFlag}
                </motion.span>
                <span className="font-display text-2xl uppercase tracking-wider text-ink/90">
                  {scorerName}
                </span>
              </motion.div>

              {/* Ground shadow pulse */}
              <motion.div
                className="mt-6 h-1 w-32 rounded-full bg-accent/30 blur-md"
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { GoalOverlay };
