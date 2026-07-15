"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Connection, PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TeamPicker } from "@/components/ui/team-picker";
import { LiveIndicator } from "@/components/ui/live-indicator";
import { useWallet } from "@/components/wallet-provider";
import { api } from "@/lib/api-client";
import { buildJoinPoolTx, getUsdcMintForNetwork, deriveMemberPdaClient } from "@/lib/solana-client";
import { TopNav } from "@/components/ui/top-nav";
import {
  Users, DollarSign, Check, Globe, AlertCircle,
  Wallet, Loader2, EyeOff, Swords,
} from "lucide-react";

type Step = "connect" | "name" | "signing" | "confirm";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { address, connected, connect, connecting, getProvider, ensureAuth } = useWallet();
  const [pool, setPool] = useState<any>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [spotsRemaining, setSpotsRemaining] = useState(0);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("connect");
  const [name, setName] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [sigStatus, setSigStatus] = useState<string | null>(null);
  const [joinedTeam, setJoinedTeam] = useState<any>(null);

  useEffect(() => {
    const joinCode = params.id as string;
    Promise.all([
      api.pools.get(joinCode),
      api.pools.teams(joinCode).catch(() => null),
    ])
      .then(([poolRes, teamsRes]) => {
        setPool(poolRes.pool);
        setMemberCount(poolRes.memberCount ?? 0);
        setSpotsRemaining(poolRes.spotsRemaining ?? 0);
        if (teamsRes) setTeams(teamsRes.teams);
      })
      .catch(() => setError("Pool not found"))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (connected && step === "connect") {
      setStep("name");
    }
  }, [connected, step]);

  async function handleJoin() {
    if (!pool || !name.trim() || !address || !selectedTeamId) return;
    setJoining(true);
    setError(null);

    try {
      const joinCode = params.id as string;
      const isPaid = Number(pool.entryFeeUsdc) > 0;

      if (isPaid) {
        setStep("signing");
        setSigStatus("Authenticating...");
        await ensureAuth();

        setSigStatus("Building transaction...");
        const provider = await getProvider();

        const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC;
        if (!rpc) throw new Error("RPC URL not configured");
        const conn = new Connection(rpc, "confirmed");

        const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "mainnet-beta";
        const programIdStr = process.env.NEXT_PUBLIC_SWEEPR_PROGRAM_ID ?? "6bvmJVnmogfwcVTrU9y6MaM9G8vYRQBXeHbiZw5BU2sC";
        const programId = new PublicKey(programIdStr);
        const usdcMint = getUsdcMintForNetwork(network);

        const entryFeeSol = Number(pool.entryFeeUsdc);

        const memberPda = deriveMemberPdaClient(pool.id, provider.publicKey, programId);
        setSigStatus("Checking membership status...");
        const memberAccount = await conn.getAccountInfo(memberPda);

        let sig = null;
        if (memberAccount) {
          setSigStatus("Retrieving previous join details...");
          const signatures = await conn.getSignaturesForAddress(memberPda, { limit: 1 });
          if (signatures && signatures.length > 0) {
            sig = signatures[0].signature;
          }
        }

        if (!sig) {
          const teamIdBytes = Array.from(new TextEncoder().encode(selectedTeamId)).slice(0, 8);
          while (teamIdBytes.length < 8) teamIdBytes.push(0);

          const { tx } = await buildJoinPoolTx(
            pool.id,
            provider.publicKey,
            teamIdBytes,
            programId,
            usdcMint,
            conn,
            entryFeeSol,
          );

          setSigStatus("Sign in your wallet...");
          const signedResult = await provider.signTransaction(tx);
          const signedTx = signedResult.transaction ?? signedResult;
          setSigStatus("Sending to Solana...");
          sig = await conn.sendRawTransaction(signedTx.serialize());
          setSigStatus("Confirming transaction...");

          let confirmed = false;
          const maxRetries = 45;
          for (let i = 0; i < maxRetries; i++) {
            const status = await conn.getSignatureStatus(sig);
            const val = status?.value;
            if (val && (val.confirmationStatus === "confirmed" || val.confirmationStatus === "finalized")) {
              confirmed = true;
              break;
            }
            if (val && val.err) {
              throw new Error(`Transaction failed on-chain: ${JSON.stringify(val.err)}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
          if (!confirmed) {
            const checkPdaExists = await conn.getAccountInfo(memberPda);
            if (!checkPdaExists) {
              throw new Error("Transaction confirmation timed out. Please check your wallet history.");
            }
          }
        }

        setSigStatus("Verifying & finalizing...");
        const result = await api.pools.join(joinCode, name.trim(), selectedTeamId, sig, passphrase || undefined);

        setJoinedTeam({
          teamId: selectedTeamId,
          teamName: teams.find((t) => t.teamId === selectedTeamId)?.teamName ?? selectedTeamId,
          flagUrl: teams.find((t) => t.teamId === selectedTeamId)?.flagUrl ?? null,
        });
        setStep("confirm");
      } else {
        await ensureAuth();
        const result = await api.pools.join(joinCode, name.trim(), selectedTeamId, undefined, passphrase || undefined);

        setJoinedTeam({
          teamId: selectedTeamId,
          teamName: teams.find((t) => t.teamId === selectedTeamId)?.teamName ?? selectedTeamId,
          flagUrl: teams.find((t) => t.teamId === selectedTeamId)?.flagUrl ?? null,
        });
        setStep("confirm");
      }
    } catch (e: any) {
      if (e.code === "TEAM_TAKEN") {
        setError(e.message);
        setStep("name");
        setSelectedTeamId(null);
        const joinCode = params.id as string;
        api.pools.teams(joinCode)
          .then((data) => setTeams(data.teams))
          .catch(() => {});
      } else {
        setError(e.message || "Failed to join pool");
        setStep("name");
      }
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
          <p className="font-mono text-[11px] text-muted-foreground/40">Loading pool...</p>
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
              <AlertCircle className="h-8 w-8 text-primary" />
              <p className="font-display text-sm uppercase tracking-wider text-foreground">{error}</p>
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
                        <p className="font-display text-lg uppercase tracking-wider text-foreground">
                          {pool?.name}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/40">
                          <Wallet className="h-3 w-3 text-primary" />
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
                        <p className="font-display text-lg uppercase tracking-wider text-foreground">
                          {pool?.name}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/40">
                          {pool?.isPrivate ? (
                            <><EyeOff className="h-3 w-3 text-muted-foreground" /> Private</>
                          ) : (
                            <><Globe className="h-3 w-3 text-muted-foreground" /> Public</>
                          )}
                          {pool?.scope && pool.scope !== "all" && (
                            <Badge variant="outline" size="sm" className="ml-1">
                              <Swords className="h-2.5 w-2.5" />
                              {pool.scope === "single" ? "1 Match" : "Custom"}
                            </Badge>
                          )}
                        </p>
                      </div>
                      <LiveIndicator label="OPEN" />
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-6">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center gap-1 rounded-md bg-muted/30 px-3 py-3">
                        <DollarSign className="h-4 w-4 text-money" />
                        <span className="font-mono text-sm font-medium text-foreground">
                          {pool?.entryFeeUsdc}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                          SOL
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-md bg-muted/30 px-3 py-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm font-medium text-foreground">
                          {memberCount}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                          In
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-md bg-muted/30 px-3 py-3">
                        <span className="font-mono text-sm font-medium text-foreground">
                          {spotsRemaining}
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                          Spots
                        </span>
                      </div>
                    </div>

                    <Input
                      id="name"
                      label="Your Name"
                      placeholder="Enter your display name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />

                    {pool?.isPrivate && (
                      <Input
                        id="passphrase"
                        label="Pool Passphrase"
                        placeholder="Enter the pool passphrase"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                      />
                    )}

                    <TeamPicker
                      teams={teams}
                      selectedId={selectedTeamId}
                      onChange={setSelectedTeamId}
                      disabled={joining}
                    />

                    {error && (
                      <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <p className="font-mono text-[11px] text-primary">{error}</p>
                      </div>
                    )}

                    <Button
                      size="lg"
                      className="w-full"
                      disabled={!name.trim() || !selectedTeamId || joining}
                      onClick={handleJoin}
                    >
                      {joining ? (
                        <>Joining...</>
                      ) : (
                        <>
                          <Users className="h-4 w-4" />
                          {Number(pool?.entryFeeUsdc) > 0
                            ? `Pay ${pool.entryFeeUsdc} SOL & Join`
                            : "Join Free"}
                        </>
                      )}
                    </Button>

                    {Number(pool?.entryFeeUsdc) > 0 && (
                      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30">
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
                      <Loader2 className="h-12 w-12 text-primary" />
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-lg uppercase tracking-wider text-foreground">
                        Processing Payment
                      </p>
                      <p className="mt-2 font-mono text-xs text-muted-foreground/60">
                        {sigStatus ?? "Sending transaction..."}
                      </p>
                    </div>
                    <div className="flex gap-1 font-mono text-[10px] text-muted-foreground/30">
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
                    {error && (
                      <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <p className="font-mono text-[11px] text-primary">{error}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "confirm" && joinedTeam && (
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
                      {joinedTeam.flagUrl ? (
                        <img src={joinedTeam.flagUrl} alt="" className="h-16 w-24 rounded-sm object-cover" />
                      ) : (
                        <span className="text-4xl">🏆</span>
                      )}
                    </motion.div>
                    <div className="text-center">
                      <p className="font-display text-2xl uppercase tracking-wider text-money">
                        {joinedTeam.teamName}
                      </p>
                      <p className="mt-1 font-body text-sm text-muted-foreground">
                        You&apos;re cheering for {joinedTeam.teamName} this Cup.
                      </p>
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
