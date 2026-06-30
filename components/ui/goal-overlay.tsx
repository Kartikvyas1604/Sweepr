"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";

interface GoalOverlayProps {
  show: boolean;
  scorerName: string;
  teamFlag: string;
}

function generateFootballTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#f0ead6";
  ctx.fillRect(0, 0, size, size);

  function drawPentagon(cx: number, cy: number, r: number, rot: number) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "#1a1a1a";
    ctx.fill();
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < 5; i++) {
      const a = rot + (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const mx = cx + (r * 2.2) * Math.cos(a);
      const my = cy + (r * 2.2) * Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(mx, my);
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  const positions = [
    { x: size * 0.5, y: size * 0.5, r: size * 0.1, rot: 0 },
    { x: size * 0.25, y: size * 0.25, r: size * 0.08, rot: 0.5 },
    { x: size * 0.75, y: size * 0.25, r: size * 0.08, rot: 1.0 },
    { x: size * 0.25, y: size * 0.75, r: size * 0.08, rot: 1.5 },
    { x: size * 0.75, y: size * 0.75, r: size * 0.08, rot: 2.0 },
    { x: size * 0.1, y: size * 0.5, r: size * 0.07, rot: 0.8 },
    { x: size * 0.9, y: size * 0.5, r: size * 0.07, rot: 1.3 },
    { x: size * 0.5, y: size * 0.15, r: size * 0.07, rot: 0.3 },
    { x: size * 0.5, y: size * 0.85, r: size * 0.07, rot: 2.5 },
    { x: size * 0.35, y: size * 0.35, r: size * 0.05, rot: 0.7 },
    { x: size * 0.65, y: size * 0.35, r: size * 0.05, rot: 1.8 },
    { x: size * 0.35, y: size * 0.65, r: size * 0.05, rot: 2.2 },
    { x: size * 0.65, y: size * 0.65, r: size * 0.05, rot: 0.4 },
  ];

  for (const p of positions) {
    drawPentagon(p.x, p.y, p.r, p.rot);
  }

  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.arc(x, y, Math.random() * 3 + 1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

function Football({ side, onImpact }: { side: "left" | "right"; onImpact: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => generateFootballTexture(), []);
  const startX = side === "left" ? -8 : 8;
  const dir = side === "left" ? 1 : -1;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!meshRef.current) return;

    const duration = 0.8;
    const progress = Math.min(t / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    meshRef.current.position.x = startX + dir * eased * 12;
    meshRef.current.position.y = Math.sin(eased * Math.PI * 1.5) * 1.5;
    meshRef.current.position.z = 5 - eased * 7;

    const grow = 1 + eased * 4;
    meshRef.current.scale.setScalar(grow);

    meshRef.current.rotation.x += 0.08;
    meshRef.current.rotation.y += 0.12;
    meshRef.current.rotation.z += 0.04;

    if (progress >= 1) {
      onImpact();
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial
        map={texture}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  );
}

function ShatterParticles({ count = 40 }: { count?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      offset: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 12 - 5,
      ),
      size: Math.random() * 0.12 + 0.03,
      color: Math.random() > 0.3 ? "#f0ead6" : "#1a1a1a",
    }));
  }, [count]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const p = particles[i];
      child.position.x = p.offset.x + p.velocity.x * t;
      child.position.y = p.offset.y + p.velocity.y * t - 4.9 * t * t;
      child.position.z = p.offset.z + p.velocity.z * t;
      child.rotation.x += 0.1;
      child.rotation.y += 0.15;
    });
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i} position={p.offset}>
          <boxGeometry args={[p.size, p.size, p.size]} />
          <meshStandardMaterial color={p.color} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function FootballScene({ show, onGoalText }: { show: boolean; side: "left" | "right"; onGoalText: () => void }) {
  const [phase, setPhase] = useState<"fly" | "impact" | "goal">("fly");

  useEffect(() => {
    if (!show) {
      setPhase("fly");
    }
  }, [show]);

  const handleImpact = () => {
    setPhase("impact");
    setTimeout(() => {
      setPhase("goal");
      onGoalText();
    }, 300);
  };

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 6], fov: 60 }}
      style={{ position: "absolute", inset: 0, zIndex: 40, pointerEvents: "none" }}
      gl={{ alpha: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-3, 2, -3]} intensity={0.3} />
      {phase === "fly" && <Football side="left" onImpact={handleImpact} />}
      {phase === "goal" && <ShatterParticles count={50} />}
    </Canvas>
  );
}

function CrackOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.svg
          className="pointer-events-none absolute inset-0 z-30 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="0.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <line x1="20" y1="10" x2="45" y2="40" stroke="rgba(235,86,0,0.6)" strokeWidth="0.3" filter="url(#glow)" />
          <line x1="45" y1="40" x2="55" y2="80" stroke="rgba(235,86,0,0.5)" strokeWidth="0.25" filter="url(#glow)" />
          <line x1="55" y1="80" x2="30" y2="95" stroke="rgba(235,86,0,0.3)" strokeWidth="0.2" filter="url(#glow)" />
          <line x1="45" y1="40" x2="70" y2="30" stroke="rgba(235,86,0,0.4)" strokeWidth="0.2" filter="url(#glow)" />
          <line x1="70" y1="30" x2="85" y2="50" stroke="rgba(235,86,0,0.3)" strokeWidth="0.15" filter="url(#glow)" />
          <line x1="45" y1="40" x2="50" y2="15" stroke="rgba(235,86,0,0.35)" strokeWidth="0.2" filter="url(#glow)" />
          <line x1="50" y1="15" x2="65" y2="5" stroke="rgba(235,86,0,0.25)" strokeWidth="0.15" filter="url(#glow)" />
          <line x1="30" y1="60" x2="15" y2="55" stroke="rgba(235,86,0,0.25)" strokeWidth="0.15" filter="url(#glow)" />
          <line x1="60" y1="70" x2="80" y2="75" stroke="rgba(235,86,0,0.2)" strokeWidth="0.12" filter="url(#glow)" />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}

function GoalOverlay({ show, scorerName, teamFlag }: GoalOverlayProps) {
  const [side] = useState<"left" | "right">(() => Math.random() > 0.5 ? "left" : "right");
  const [impact, setImpact] = useState(false);
  const [showCrack, setShowCrack] = useState(false);
  const [showGoalText, setShowGoalText] = useState(false);
  const [showScorer, setShowScorer] = useState(false);

  useEffect(() => {
    if (!show) {
      setImpact(false);
      setShowCrack(false);
      setShowGoalText(false);
      setShowScorer(false);
    }
  }, [show]);

  const handleImpact = () => {
    setImpact(true);
    setShowCrack(true);
  };

  const handleGoalText = () => {
    setShowGoalText(true);
    setTimeout(() => setShowScorer(true), 300);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Flash on impact */}
          <motion.div
            className="absolute inset-0 bg-accent/15"
            animate={{ opacity: impact ? [0, 0.6, 0] : 0 }}
            transition={{ duration: 0.4 }}
          />

          {/* Screen shake on impact */}
          <motion.div
            className="absolute inset-0"
            animate={
              impact
                ? {
                    x: [0, -4, 4, -3, 3, -2, 2, -1, 1, 0],
                    y: [0, 3, -4, 2, -3, 1, -2, 0, 1, 0],
                    rotate: [0, -1, 1, -0.8, 0.8, -0.5, 0.5, -0.3, 0.3, 0],
                  }
                : { x: 0, y: 0, rotate: 0 }
            }
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <FootballScene show={show} side={side} onGoalText={handleGoalText} />
          </motion.div>

          {/* Crack overlay */}
          <CrackOverlay show={showCrack} />

          {/* GOAL! text */}
          <AnimatePresence>
            {showGoalText && (
              <motion.div
                className="relative z-50 flex flex-col items-center gap-3"
                initial={{ scale: 2.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 14 }}
              >
                <motion.span
                  className="font-display text-8xl uppercase tracking-tight text-accent sm:text-9xl"
                  style={{
                    textShadow:
                      "0 0 40px rgba(235,86,0,0.6), 0 0 80px rgba(235,86,0,0.3), 0 0 120px rgba(235,86,0,0.15)",
                  }}
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 1.5 }}
                >
                  GOAL!
                </motion.span>
                {showScorer && (
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    <span className="text-2xl">{teamFlag}</span>
                    <span className="font-display text-xl uppercase tracking-wider text-ink">
                      {scorerName}
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { GoalOverlay };
