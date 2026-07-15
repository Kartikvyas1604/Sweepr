const API_BASE = "";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("sweepr_jwt");
  const expiresAt = localStorage.getItem("sweepr_jwt_expires_at");
  if (!token || !expiresAt) return null;
  if (Date.now() >= new Date(expiresAt).getTime()) {
    localStorage.removeItem("sweepr_jwt");
    localStorage.removeItem("sweepr_jwt_expires_at");
    return null;
  }
  return token;
}

export function setToken(token: string, expiresAt?: string) {
  localStorage.setItem("sweepr_jwt", token);
  if (expiresAt) {
    localStorage.setItem("sweepr_jwt_expires_at", expiresAt);
  }
}

export function clearToken() {
  localStorage.removeItem("sweepr_jwt");
  localStorage.removeItem("sweepr_jwt_expires_at");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiClientError(res.status, body.code || "API_ERROR", body.error || "Request failed");
  }

  return res.json();
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const api = {
  auth: {
    requestNonce: (wallet: string) =>
      request<{ nonce: string; message: string }>("/api/auth/nonce", {
        method: "POST",
        body: JSON.stringify({ wallet }),
      }),
    verify: (wallet: string, signature: string, nonce: string) =>
      request<{ token: string; wallet: string; expiresAt: string }>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ wallet, signature, nonce }),
      }),
  },

  pools: {
    list: (wallet?: string) => {
      const params = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
      return request<{ pools: any[] }>(`/api/pools${params}`);
    },
    create: (
      name: string,
      entryFeeUsdc: number,
      scope: "all" | "single" | "custom" = "all",
      fixtureIds?: string[],
      isPrivate?: boolean,
      passphrase?: string,
    ) =>
      request<{ pool: any; joinUrl: string; availableTeams: any[]; fixtureCount: number }>("/api/pools", {
        method: "POST",
        body: JSON.stringify({ name, entryFeeUsdc, scope, fixtureIds, isPrivate, passphrase }),
      }),
    get: (joinCode: string) =>
      request<{ pool: any; leaderboard: any[]; memberCount: number; spotsRemaining: number; joinUrl: string }>(
        `/api/pools/${joinCode}`,
      ),
    join: (joinCode: string, displayName: string, teamId: string, stakeTxSignature?: string, passphrase?: string) =>
      request<{ member: any; leaderboard: any[] }>(
        `/api/pools/${joinCode}/join`,
        {
          method: "POST",
          body: JSON.stringify({ displayName, teamId, stakeTxSignature, passphrase }),
        },
      ),
    teams: (joinCode: string) =>
      request<{ teams: any[]; scope: string; totalTeams: number; takenCount: number; availableCount: number }>(
        `/api/pools/${joinCode}/teams`,
      ),
    leaderboard: (joinCode: string) =>
      request<{ leaderboard: any[]; recentEvents: any[]; lastUpdated: string; poolStatus: string }>(
        `/api/pools/${joinCode}/leaderboard`,
      ),
  },

  fixtures: {
    options: () =>
      request<{ grouped: any[]; all: any[]; totalCount: number }>("/api/fixtures/options"),
    get: (liveOnly = false) =>
      request<{ fixtures: any[] }>(`/api/fixtures${liveOnly ? "?live=true" : ""}`),
  },
};
