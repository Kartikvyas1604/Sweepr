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
import { api, setToken, getToken, clearToken } from "@/lib/api-client";
import { WalletSelector, type DetectedWallet } from "./wallet-selector";

interface WalletContextValue {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  ensureAuth: () => Promise<void>;
  getProvider: () => Promise<any>;
}

const WalletContext = createContext<WalletContextValue>({
  address: null,
  connected: false,
  connecting: false,
  connect: async () => {},
  disconnect: () => {},
  ensureAuth: async () => {},
  getProvider: async () => null,
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

async function signWithProvider(provider: any, message: string): Promise<string | null> {
  const encoded = new TextEncoder().encode(message);
  let result: any;
  try {
    result = await provider.signMessage(encoded);
  } catch {
    try {
      result = await provider.signMessage(encoded, "utf8");
    } catch {
      return null;
    }
  }
  const sigBytes = result?.signature ?? result;
  if (!sigBytes || sigBytes.length !== 64) return null;
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
    const signature = sigEncoded ?? "";
    const { token, expiresAt } = await api.auth.verify(wallet, signature, nonce);
    if (token) setToken(token, expiresAt);
  }, []);

  const handleWalletSelect = useCallback(async (detected: DetectedWallet) => {
    setSelectorOpen(false);
    providerRef.current = detected.provider;
    storeWalletId(detected.id);
    const resolve = pendingResolveRef.current;
    pendingResolveRef.current = null;
    if (resolve) resolve(detected.provider);
  }, []);

  const getWalletProvider = useCallback(async (expectedAddress?: string | null): Promise<any> => {
    const storedId = getStoredWalletId();
    if (storedId && providerRef.current) {
      // Verify the stored provider matches the expected address — if not, force
      // re-selection (handles case where user switched wallets between sessions)
      if (expectedAddress && providerRef.current.publicKey?.toBase58() !== expectedAddress) {
        providerRef.current = null;
      } else {
        return providerRef.current;
      }
    }
    return new Promise((resolve) => {
      pendingResolveRef.current = resolve;
      setSelectorOpen(true);
    });
  }, []);

  const ensureAuth = useCallback(async () => {
    const existing = getToken();
    if (existing) return;
    const provider = await getWalletProvider(address);
    // Always call connect() to establish a wallet session — providers need an
    // active session before signMessage() works. We verify the connected wallet
    // matches the expected address to catch extension conflicts (e.g. BagPack
    // intercepting when Phantom was originally connected).
    const connectResult = await provider.connect();
    const wallet = connectResult.publicKey.toBase58();
    if (!wallet) throw new Error("No wallet address available");
    if (address && wallet !== address) {
      providerRef.current = null;
      localStorage.removeItem("sweepr_wallet_id");
      throw new Error(
        `Connected wallet ${wallet} does not match expected wallet ${address}. ` +
        "Please refresh and reconnect with the correct wallet.",
      );
    }
    setAddress(wallet);
    storeWallet(wallet);
    try {
      await doAuth(provider, wallet);
      const jwt = getToken();
      console.log("[ensureAuth] JWT after doAuth:", jwt ? jwt.slice(0, 20) + "..." : "NULL");
    } catch (e: any) {
      console.error("[ensureAuth] doAuth failed:", e?.message ?? e);
      throw e;
    }
  }, [getWalletProvider, doAuth, address]);

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setConnecting(true);
    try {
      const provider = await getWalletProvider(address);
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
  }, [getWalletProvider, address]);

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
          getProvider: getWalletProvider,
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
