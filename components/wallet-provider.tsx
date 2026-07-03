"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import bs58 from "bs58";
import { api, setToken, clearToken } from "@/lib/api-client";

interface WalletContextValue {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
  getToken: () => string | null;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  connected: false,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
  signMessage: async () => "",
  getToken: () => null,
});

function getStoredWallet(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sweepr_wallet");
}

function storeWallet(addr: string | null) {
  if (addr) localStorage.setItem("sweepr_wallet", addr);
  else localStorage.removeItem("sweepr_wallet");
}

function getSolanaProvider() {
  if (typeof window === "undefined") return null;
  const anyWindow = window as any;
  return anyWindow.phantom?.solana || anyWindow.solana || null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const stored = getStoredWallet();
    if (stored) setAddress(stored);
  }, []);

  const getProvider = useCallback(() => {
    const provider = getSolanaProvider();
    if (!provider?.isPhantom && !provider?.isBackpack) {
      throw new Error("Please install Phantom or Backpack wallet");
    }
    return provider;
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    const provider = getProvider();
    if (!provider.signMessage) {
      throw new Error("Wallet does not support message signing");
    }
    const encoded = new TextEncoder().encode(message);
    const { signature } = await provider.signMessage(encoded, "utf8");
    return bs58.encode(signature);
  }, [getProvider]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const provider = getProvider();
      const { publicKey } = await provider.connect();
      const wallet = publicKey.toBase58();
      setAddress(wallet);
      storeWallet(wallet);
    } catch (e: any) {
      if (e.code === 4001) {
        throw new Error("Connection rejected");
      }
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [getProvider]);

  const disconnect = useCallback(() => {
    setAddress(null);
    storeWallet(null);
    clearToken();
    const provider = getSolanaProvider();
    if (provider?.disconnect) provider.disconnect();
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        connected: !!address,
        connecting,
        connect,
        disconnect,
        signMessage,
        getToken: () => {
          if (typeof window === "undefined") return null;
          return localStorage.getItem("sweepr_jwt");
        },
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
