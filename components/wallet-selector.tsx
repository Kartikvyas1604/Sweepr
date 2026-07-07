"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wallet } from "lucide-react";

interface DetectedWallet {
  id: string;
  name: string;
  icon: string;
  provider: any;
}

function detectWallets(): DetectedWallet[] {
  const wallets: DetectedWallet[] = [];
  const w = typeof window !== "undefined" ? (window as any) : null;
  if (!w) return wallets;

  const seen = new Set();

  const add = (id: string, name: string, icon: string, provider: any) => {
    if (!provider || seen.has(provider)) return;
    seen.add(provider);
    wallets.push({ id, name, icon, provider });
  };

  add("phantom", "Phantom", "👻", w.phantom?.solana);
  add("backpack", "Backpack", "🎒", w.solana?.isBackpack ? w.solana : null);
  add("solflare", "Solflare", "🔥", w.solflare?.solana ?? w.solflare);
  add("glow", "Glow", "✨", w.glow);
  add("slope", "Slope", "📐", w.slope);
  add("coin98", "Coin98", "🪙", w.coin98);
  add("trust", "Trust Wallet", "🛡️", w.trustwallet);
  add("okx", "OKX Wallet", "🟢", w.okxwallet?.solana);
  add("exodus", "Exodus", "🔺", w.exodus?.solana);
  add("tipLink", "TipLink", "🔗", w.tiplink);

  return wallets;
}

interface WalletSelectorProps {
  open: boolean;
  onSelect: (wallet: DetectedWallet) => void;
  onClose: () => void;
}

export function WalletSelector({ open, onSelect, onClose }: WalletSelectorProps) {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);

  useEffect(() => {
    if (open) {
      setWallets(detectWallets());
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <h2 className="font-display text-sm uppercase tracking-wider text-foreground">
                  Connect Wallet
                </h2>
              </div>
              <button onClick={onClose} className="rounded-md p-1 text-muted-foreground/40 hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {wallets.length === 0 ? (
              <p className="py-8 text-center font-body text-sm text-muted-foreground/40">
                No Solana wallets detected.
                <br />
                Please install Phantom or Backpack.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => onSelect(wallet)}
                    className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3 text-left transition-all duration-200 hover:border-primary/20 hover:bg-muted/40"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-lg">
                      {wallet.icon}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-display text-sm font-medium tracking-tight text-foreground">
                        {wallet.name}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/40">
                        Solana Wallet
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export type { DetectedWallet };
