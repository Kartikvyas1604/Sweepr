"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Connection, PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TeamDraw } from "@/components/ui/team-draw";
import { LiveIndicator } from "@/components/ui/live-indicator";
import { useWallet } from "@/components/wallet-provider";
import { api } from "@/lib/api-client";
import { buildJoinPoolTx, getUsdcMintForNetwork } from "@/lib/solana-client";
import { TopNav } from "@/components/ui/top-nav";
import {
  Users, DollarSign, Check, Globe, AlertCircle,
  Wallet, Loader2,
} from "lucide-react";

type Step = "connect" | "name" | "signing" | "draw" | "confirm";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { address, connected, connect, connecting, getProvider } = useWallet();
  const [pool, setPool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("connect");
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [sigStatus, setSigStatus] = useState<string | null>(null);
  const [drawTeams, setDrawTeams] = useState<any[]>([]);
  const [assignedTeam, setAssignedTeam] = useState<any>(null);

  useEffect(() => {
    const joinCode = params.id as string;
    api.pools.get(joinCode)
      .then((data) => {
        setPool(data.pool);
      })
      .catch(() => {
        setError("Pool not found");
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (connected && step === "connect") {
      setStep("name");
    }
  }, [connected, step]);

  async function handleJoin() {
    if (!pool || !name.trim() || !address) return;
    setJoining(true);

    try {
      const joinCode = params.id as string;
      const isPaid = Number(pool.entryFeeUsdc) > 0;

      if (isPaid) {
        setStep("signing");
        setSigStatus("Assigning your team...");

        const assignRes = await api.pools.assignTeam(joinCode);

        setSigStatus("Building transaction...");
        const provider = await getProvider();

        const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC;
        if (!rpc) throw new Error("RPC URL not configured");
        const conn = new Connection(rpc, "confirmed");

        const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "mainnet-beta";
        const programIdStr = process.env.NEXT_PUBLIC_SWEEPR_PROGRAM_ID ?? "6bvmJVnmogfwcVTrU9y6MaM9G8vYRQBXeHbiZw5BU2sC";
        const programId = new PublicKey(programIdStr);
        const usdcMint = getUsdcMintForNetwork(network);

        const tx = await buildJoinPoolTx(
          pool.id,
          provider.publicKey,
          assignRes.teamIdBytes,
          programId,
          usdcMint,
          conn,
        );

        setSigStatus("Sign in your wallet...");
        const signedTx = await provider.signTransaction(tx);

        setSigStatus("Sending to Solana...");
        const sig = await conn.sendRawTransaction(signedTx.serialize());
        setSigStatus("Confirming transaction...");

        const latestBlockhash = await conn.getLatestBlockhash();
        await conn.confirmTransaction({
          signature: sig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        });

        setSigStatus("Verifying & finalizing...");
        const result = await api.pools.join(joinCode, name.trim(), sig, assignRes.tempToken);

        setAssignedTeam(result.assignedTeam);
        setStep("confirm");
      } else {
        const result = await api.pools.join(joinCode, name.trim());
        setAssignedTeam(result.assignedTeam);
        setStep("confirm");
      }
    } catch (e: any) {
      setError(e.message || "Failed to join pool");
      if (step === "signing") setStep("name");
    } finally {
      setJoining(false);
      setSigStatus(null);
    }
  }

  if (loading) {
    return (
      <div className="relative flex min-h-dvh flex-col">
        <TopNav title="Join Pool" showBack />
        <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
          <p className="font-mono text-[11px] text-ink-muted/40">Loading pool...</p>
        </main>
      </div>
    );
  }

  if (error && step !== "name" && step !== "signing") {
    return (
      <div className="relative flex min-h-dvh flex-col">
        <TopNav title="Join Pool" showBack />
        <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <AlertCircle className="h-8 w-8 text-accent" />
              <p className="font-display text-sm uppercase tracking-wider text-ink">{error}</p>
              <Button size="sm" onClick={() => router.push("/")}>Create a pool</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <TopNav title="Join Pool" showBack />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {step === "connect" && (
              <motion.div
                key="connect"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex w-full items-center justify-between">
                      <div>
                        <p className="font-display text-lg uppercase tracking-wider text-ink">
                          {pool?.name}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-ink-muted/40">
                          <Wallet className="h-3 w-3 text-accent" />
                          Connect wallet to join
                        </p>
                      </div>
                      <LiveIndicator label="OPEN" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-6">
                    <Button
                      size="lg"
                      className="w-full"
                      disabled={connecting}
                      onClick={connect}
                    >
                      <Wallet className="h-4 w-4" />
                      {connecting ? "Connecting..." : "Connect Wallet"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "name" && (
              <motion.div
                key="name"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex w-full items-center justify-between">
                      <div>
                        <p className="font-display text-lg uppercase tracking-wider text-ink">
                          {pool?.name}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-ink-muted/40">
                          <Globe className="h-3 w-3 text-ink-muted" /> Public
                        </p>
                      </div>
                      <LiveIndicator label="OPEN" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-6">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center gap-1 rounded-md bg-elevated/30 px-3 py-3">
                        <DollarSign className="h-4 w-4 text-money" />
                        <span className="font-mono text-sm font-medium text-ink">
                          {pool?.entryFeeUsdc}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-ink-muted/40">
                          Buy-in
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-md bg-elevated/30 px-3 py-3">
                        <Users className="h-4 w-4 text-ink-muted" />
                        <span className="font-mono text-sm font-medium text-ink">
                          {pool?.memberCount ?? 0}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-ink-muted/40">
                          In
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-md bg-elevated/30 px-3 py-3">
                        <span className="font-mono text-sm font-medium text-ink">
                          {pool?.spotsRemaining}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-ink-muted/40">
                          Spots
                        </span>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 rounded-md bg-accent/10 px-3 py-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-accent" />
                        <p className="font-mono text-[11px] text-accent">{error}</p>
                      </div>
                    )}

                    <Input
                      id="name"
                      label="Your Name"
                      placeholder="Enter your display name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />

                    <Button
                      size="lg"
                      className="w-full"
                      disabled={!name.trim() || joining}
                      onClick={handleJoin}
                    >
                      {joining ? (
                        <>Joining...</>
                      ) : (
                        <>
                          <Users className="h-4 w-4" />
                          {Number(pool?.entryFeeUsdc) > 0
                            ? `Pay ${pool.entryFeeUsdc} USDC & Join`
                            : "Join Free"}
                        </>
                      )}
                    </Button>

                    {Number(pool?.entryFeeUsdc) > 0 && (
                      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-ink-muted/30">
                        Entry fee held in escrow. Winner takes all minus 5% fee.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "signing" && (
              <motion.div
                key="signing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card>
                  <CardContent className="flex flex-col items-center gap-6 py-12">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="h-12 w-12 text-accent" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-lg uppercase tracking-wider text-ink">
                        Processing Payment
                      </p>
                      <p className="mt-2 font-mono text-xs text-ink-muted/60">
                        {sigStatus ?? "Sending transaction..."}
                      </p>
                    </div>
                    <div className="flex gap-1 font-mono text-[10px] text-ink-muted/30">
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        CONFIRMING
                      </motion.span>
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                      >
                        ·
                      </motion.span>
                      <motion.span
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                      >
                        VERIFYING
                      </motion.span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "draw" && assignedTeam && (
              <motion.div
                key="draw"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex w-full items-center justify-between">
                      <p className="font-display text-sm uppercase tracking-wider text-ink">
                        Your Draw
                      </p>
                      <Badge variant="outline" size="sm">
                        Random
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-8">
                    <TeamDraw
                      participantName={name}
                      drawTeams={drawTeams}
                      assignedTeam={assignedTeam}
                      onRevealComplete={() => setStep("confirm")}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "confirm" && assignedTeam && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      <p className="font-display text-sm uppercase tracking-wider text-success">
                        You&apos;re In!
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-6 py-8">
                    <motion.div
                      className="flex h-24 w-24 items-center justify-center rounded-full bg-money/10"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    >
                      {assignedTeam.flagUrl ? (
                        <img src={assignedTeam.flagUrl} alt="" className="h-16 w-24 rounded-sm object-cover" />
                      ) : (
                        <span className="text-4xl">🏆</span>
                      )}
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-2xl uppercase tracking-wider text-money">
                        {assignedTeam.name}
                      </p>
                      <p className="mt-1 font-body text-sm text-ink-muted">
                        You&apos;re cheering for {assignedTeam.name} this Cup.
                      </p>
                      {assignedTeam.group && (
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-muted/40">
                          Group {assignedTeam.group}
                        </p>
                      )}
                    </div>
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => router.push(`/pool/${params.id}`)}
                    >
                      View Leaderboard
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
