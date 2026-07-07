"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/ui/top-nav";
import { WalletButton } from "@/components/ui/wallet-button";
import { api } from "@/lib/api-client";
import { Plus, Users, ArrowRight, Globe } from "lucide-react";

export default function PoolsPage() {
  const router = useRouter();
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.pools.list().then((data) => {
      setPools(data.pools);
    }).catch(() => {
      setPools([]);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <TopNav
        title="All Pools"
        right={<WalletButton />}
        onLogoClick={() => router.push("/")}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="font-display text-2xl uppercase tracking-tight text-foreground sm:text-3xl">
              All Pools
            </h1>
            <p className="mt-1 font-body text-sm text-muted-foreground">
              {pools.length} pool{pools.length !== 1 ? "s" : ""} available
            </p>
          </div>
          <Button size="md" onClick={() => router.push("/")}>
            <Plus className="h-4 w-4" />
            New Pool
          </Button>
        </motion.div>

        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-16"
          >
            <p className="font-mono text-[11px] text-muted-foreground/40">Loading pools...</p>
          </motion.div>
        ) : pools.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-16"
          >
            <Users className="h-10 w-10 text-muted-foreground/20" />
            <p className="font-body text-sm text-muted-foreground/40">No pools yet</p>
            <Button size="sm" onClick={() => router.push("/")}>
              Create the first pool
            </Button>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3">
            {pools.map((pool, i) => (
              <motion.div
                key={pool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
              >
                <Card
                  className="cursor-pointer transition-all duration-200 hover:bg-muted/20"
                  onClick={() => router.push(`/pool/${pool.joinCode}`)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-body text-sm font-medium text-foreground">
                            {pool.name}
                          </p>
                          {pool.status === "settled" ? (
                            <Badge variant="elevated" size="sm">Settled</Badge>
                          ) : (
                            <Badge variant="live" size="sm">Open</Badge>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground/40">
                          <span>{pool.memberCount} players</span>
                          <span>·</span>
                          <span>{pool.totalStakedUsdc} SOL pot</span>
                          <span>·</span>
                          <span>{pool.entryFeeUsdc} SOL entry</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-muted-foreground/30" />
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
