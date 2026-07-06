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

function extractSignatureBytes(raw: any): Uint8Array | null {
  if (!raw) return null;
  // Standard format: { signature: Uint8Array } or just Uint8Array
  let bytes = raw.signature ?? raw;
  // Buffer-like object: { type: "Buffer", data: [...] }
  if (bytes?.type === "Buffer" && Array.isArray(bytes.data)) {
    return new Uint8Array(bytes.data);
  }
  // Nested data property: { data: Uint8Array | number[] }
  if (bytes?.data && typeof bytes.data === "object") {
    bytes = bytes.data;
  }
  // Array of numbers: [num, num, ...]
  if (Array.isArray(bytes)) {
    return new Uint8Array(bytes);
  }
  // Already a Uint8Array-like
  if (bytes?.length === 64) {
    return bytes;
  }
  return null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function signWithProvider(provider: any, message: string): Promise<string | null> {
  const encoded = new TextEncoder().encode(message);
  let result: any;
  try {
    result = await withTimeout(provider.signMessage(encoded), 120_000);
  } catch {
    try {
      result = await withTimeout(provider.signMessage(encoded, "utf8"), 120_000);
    } catch {
      return null;
    }
  }
  const sigBytes = extractSignatureBytes(result);
  if (!sigBytes) return null;
  return bs58.encode(sigBytes);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const connectingRef = useRef(false);
  const providerRef = useRef<any>(null);
  const pendingResolveRef = useRef<((value: any) => void) | null>(null);
  const pendingRejectRef = useRef<((reason?: any) => void) | null>(null);

  useEffect(() => {
    const stored = getStoredWallet();
    if (stored) setAddress(stored);
  }, []);

  const doAuth = useCallback(async (provider: any, wallet: string) => {
    console.log("[doAuth] requesting nonce for", wallet);
    const { nonce, message } = await api.auth.requestNonce(wallet);
    console.log("[doAuth] got nonce, signing message...");
    const sigEncoded = await signWithProvider(provider, message);
    console.log("[doAuth] signed, sig length:", sigEncoded?.length);
    const signature = sigEncoded ?? "";
    console.log("[doAuth] verifying...");
    const { token, expiresAt } = await api.auth.verify(wallet, signature, nonce);
    console.log("[doAuth] verified, got token:", !!token);
    if (token) setToken(token, expiresAt);
  }, []);

  const handleWalletSelect = useCallback(async (detected: DetectedWallet) => {
    setSelectorOpen(false);
    providerRef.current = detected.provider;
    storeWalletId(detected.id);
    const resolve = pendingResolveRef.current;
    pendingResolveRef.current = null;
    pendingRejectRef.current = null;
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
    return new Promise((resolve, reject) => {
      pendingResolveRef.current = resolve;
      pendingRejectRef.current = reject;
      setSelectorOpen(true);
    });
  }, []);

  const ensureAuth = useCallback(async () => {
    const existing = getToken();
    if (existing) return;
    const provider = await getWalletProvider(address);
    // Get the wallet address without calling connect() a second time.
    // Wallets like Phantom hang if connect() is called when already connected.
    let wallet = address;
    if (!wallet) {
      const pk = provider.publicKey;
      if (pk?.toBase58) wallet = pk.toBase58();
      else if (pk) wallet = pk.toString();
    }
    if (!wallet) {
      const connectResult = await provider.connect();
      wallet = extractWalletAddress(connectResult);
    }
    if (!wallet) throw new Error("No wallet address available");
    setAddress(wallet);
    storeWallet(wallet);
    try {
      await doAuth(provider, wallet);
    } catch (e: any) {
      console.error("[ensureAuth] doAuth failed:", e?.message ?? e);
      throw e;
    }
  }, [getWalletProvider, doAuth, address]);

  function extractWalletAddress(connectResult: any): string | null {
    if (!connectResult) return null;
    const pk = connectResult.publicKey ?? connectResult;
    if (typeof pk === "string") return pk;
    if (pk?.toBase58) return pk.toBase58();
    if (pk?.toString) return pk.toString();
    return null;
  }

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setConnecting(true);
    try {
      const provider = await getWalletProvider(address);
      const connectResult = await provider.connect();
      const wallet = extractWalletAddress(connectResult);
      if (!wallet) throw new Error("Could not get wallet address from provider");
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
          const reject = pendingRejectRef.current;
          pendingResolveRef.current = null;
          pendingRejectRef.current = null;
          if (reject) reject(new Error("Wallet selection cancelled"));
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
