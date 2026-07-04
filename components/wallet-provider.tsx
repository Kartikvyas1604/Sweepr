"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import bs58 from "bs58";
import { api, setToken, clearToken } from "@/lib/api-client";
import { WalletSelector, type DetectedWallet } from "./wallet-selector";

interface WalletContextValue {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  ensureAuth: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  connected: false,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
  ensureAuth: async () => {},
});

function getStoredWallet(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sweepr_wallet");
}

function storeWallet(addr: string | null) {
  if (addr) localStorage.setItem("sweepr_wallet", addr);
  else localStorage.removeItem("sweepr_wallet");
}

function getStoredWalletId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sweepr_wallet_id");
}

function storeWalletId(id: string | null) {
  if (id) localStorage.setItem("sweepr_wallet_id", id);
  else localStorage.removeItem("sweepr_wallet_id");
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sweepr_jwt");
}

async function signWithProvider(provider: any, message: string): Promise<string> {
  const result = await provider.signMessage(new TextEncoder().encode(message));
  const sigBytes = result.signature ?? result;
  return bs58.encode(sigBytes);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const connectingRef = useRef(false);
  const providerRef = useRef<any>(null);
  const pendingResolveRef = useRef<((value: any) => void) | null>(null);

  useEffect(() => {
    const stored = getStoredWallet();
    if (stored) setAddress(stored);
  }, []);

  const doAuth = useCallback(async (provider: any, wallet: string) => {
    const { nonce, message } = await api.auth.requestNonce(wallet);
    const sigEncoded = await signWithProvider(provider, message);
    const { token } = await api.auth.verify(wallet, sigEncoded, nonce);
    setToken(token);
  }, []);

  const handleWalletSelect = useCallback(async (detected: DetectedWallet) => {
    setSelectorOpen(false);
    providerRef.current = detected.provider;
    storeWalletId(detected.id);
    const resolve = pendingResolveRef.current;
    pendingResolveRef.current = null;
    if (resolve) resolve(detected.provider);
  }, []);

  const getWalletProvider = useCallback(async (): Promise<any> => {
    const storedId = getStoredWalletId();
    if (storedId && providerRef.current) return providerRef.current;
    return new Promise((resolve) => {
      pendingResolveRef.current = resolve;
      setSelectorOpen(true);
    });
  }, []);

  const ensureAuth = useCallback(async () => {
    const existing = getToken();
    if (existing) return;
    const provider = await getWalletProvider();
    const { publicKey } = await provider.connect();
    const wallet = publicKey.toBase58();
    setAddress(wallet);
    storeWallet(wallet);
    await doAuth(provider, wallet);
  }, [getWalletProvider, doAuth]);

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setConnecting(true);
    try {
      const provider = await getWalletProvider();
      const { publicKey } = await provider.connect();
      const wallet = publicKey.toBase58();
      setAddress(wallet);
      storeWallet(wallet);
      // Auth happens lazily via ensureAuth on first action
    } catch (e: any) {
      if (e.code === 4001) throw new Error("Connection rejected");
      throw e;
    } finally {
      connectingRef.current = false;
      setConnecting(false);
    }
  }, [getWalletProvider]);

  const disconnect = useCallback(() => {
    setAddress(null);
    storeWallet(null);
    providerRef.current = null;
    clearToken();
  }, []);

  return (
    <>
      <WalletSelector
        open={selectorOpen}
        onSelect={handleWalletSelect}
        onClose={() => {
          setSelectorOpen(false);
          pendingResolveRef.current = null;
        }}
      />
      <WalletContext.Provider
        value={{
          address,
          connected: !!address,
          connecting,
          connect,
          disconnect,
          ensureAuth,
        }}
      >
        {children}
      </WalletContext.Provider>
    </>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
