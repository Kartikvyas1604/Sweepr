"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/ui/top-nav";
import { WalletButton } from "@/components/ui/wallet-button";
import { Plus, Users, Trophy, ArrowRight } from "lucide-react";

const MOCK_POOLS = [
  {
    id: "1",
    name: "Office Cup 26",
    entryFee: 10,
    participants: 8,
    totalPot: 80,
    status: "active" as const,
    yourRank: 8,
  },
  {
    id: "2",
    name: "Friday Fivers",
    entryFee: 5,
    participants: 12,
    totalPot: 60,
    status: "open" as const,
    yourRank: null,
  },
  {
    id: "3",
    name: "World Cup Winners",
    entryFee: 25,
    participants: 16,
    totalPot: 400,
    status: "settled" as const,
    yourRank: 3,
  },
];

const STATUS_COLORS = {
  open: "text-escrow border-escrow/20 bg-escrow/10" as const,
  active: "text-flare border-flare/20 bg-flare/10" as const,
  settled: "text-success border-success/20 bg-success/10" as const,
};

export default function PoolsPage() {
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
            <h1 className="font-display text-2xl uppercase tracking-tight text-chalk sm:text-3xl">
              My Pools
            </h1>
            <p className="mt-1 font-body text-sm text-chalk-muted">
              {MOCK_POOLS.length} active pools
            </p>
          </div>
          <Button size="md">
            <Plus className="h-4 w-4" />
            New Pool
          </Button>
        </motion.div>

        {/* Pools list */}
        <div className="flex flex-col gap-3">
          {MOCK_POOLS.map((pool, i) => (
            <motion.div
              key={pool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
            >
              <Card
                className="cursor-pointer transition-all duration-200 hover:border-chalk/20 hover:bg-chalk/[0.02]"
                onClick={() => {}}
              >
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        pool.status === "active"
                          ? "bg-flare/10"
                          : pool.status === "open"
                            ? "bg-escrow/10"
                            : "bg-success/10"
                      }`}
                    >
                      {pool.status === "settled" ? (
                        <Trophy className={`h-5 w-5 ${
                          pool.yourRank === 1 ? "text-goalnet" : "text-success"
                        }`} />
                      ) : (
                        <Users className={`h-5 w-5 ${
                          pool.status === "active" ? "text-flare" : "text-escrow"
                        }`} />
                      )}
                    </div>
                    <div>
                      <p className="font-body text-sm font-medium text-chalk">
                        {pool.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-chalk-muted/40">
                        <span>{pool.participants} players</span>
                        <span>·</span>
                        <span>{pool.totalPot} USDC pot</span>
                        <span>·</span>
                        <span>{pool.entryFee} USDC entry</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        pool.status === "active"
                          ? "flare"
                          : pool.status === "open"
                            ? "escrow"
                            : "success"
                      }
                      size="sm"
                    >
                      {pool.status}
                    </Badge>
                    {pool.yourRank && (
                      <span className="font-display text-lg tabular-nums text-chalk-muted">
                        #{pool.yourRank}
                      </span>
                    )}
                    <ArrowRight className="h-4 w-4 text-chalk-muted/30" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
