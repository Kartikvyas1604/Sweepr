"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/ui/top-nav";
import { WalletButton } from "@/components/ui/wallet-button";
import { getPools } from "@/lib/store";
import type { Pool } from "@/lib/types";
import { Plus, Users, ArrowRight, Globe, EyeOff } from "lucide-react";

export default function PoolsPage() {
  const router = useRouter();
  const [pools, setPools] = useState<Pool[]>([]);

  useEffect(() => {
    setPools(getPools());
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <TopNav title="My Pools" right={<WalletButton />} />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
        {/* Header */}
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <h1 className="font-display text-2xl uppercase tracking-tight text-ink sm:text-3xl">
              My Pools
            </h1>
            <p className="mt-1 font-body text-sm text-ink-muted">
              {pools.length} active {pools.length === 1 ? "pool" : "pools"}
            </p>
          </div>
          <Button size="md" onClick={() => router.push("/")}>
            <Plus className="h-4 w-4" />
            New Pool
          </Button>
        </motion.div>

        {/* Pools list */}
        {pools.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-4 py-16"
          >
            <Users className="h-10 w-10 text-ink-muted/20" />
            <p className="font-body text-sm text-ink-muted/40">No pools yet</p>
            <Button size="sm" onClick={() => router.push("/")}>
              Create your first pool
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
                  className="cursor-pointer transition-all duration-200 hover:bg-elevated/20"
                  onClick={() => router.push(`/pool/${pool.id}`)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated/50">
                        <Users className="h-5 w-5 text-ink-muted" />
                      </div>
                      <div>
                        <p className="font-body text-sm font-medium text-ink">
                          {pool.name}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-muted/40">
                          <span>{pool.participantCount} players</span>
                          <span>·</span>
                          <span>{pool.totalPot} USDC pot</span>
                          <span>·</span>
                          <span>{pool.entryFee} USDC entry</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {pool.isPrivate ? (
                        <Badge variant="outline" size="sm">
                          <EyeOff className="h-2.5 w-2.5" />
                          Private
                        </Badge>
                      ) : (
                        <Badge variant="outline" size="sm">
                          <Globe className="h-2.5 w-2.5" />
                          Public
                        </Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-ink-muted/30" />
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
