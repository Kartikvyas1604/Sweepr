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
    create: (name: string, entryFeeUsdc: number, maxMembers?: number, isPrivate?: boolean, passphrase?: string) =>
      request<{ pool: any; joinUrl: string }>("/api/pools", {
        method: "POST",
        body: JSON.stringify({ name, entryFeeUsdc, maxMembers, isPrivate, passphrase }),
      }),
    get: (joinCode: string) =>
      request<{ pool: any; leaderboard: any[]; memberCount: number; spotsRemaining: number; joinUrl: string }>(
        `/api/pools/${joinCode}`,
      ),
    assignTeam: (joinCode: string) =>
      request<{ tempToken: string; team: any; teamIdBytes: number[]; entryFeeUsdc: number }>(
        `/api/pools/${joinCode}/assign-team`,
        { method: "POST" },
      ),
    join: (joinCode: string, displayName: string, stakeTxSignature?: string, tempToken?: string, passphrase?: string) =>
      request<{ member: any; assignedTeam: any; leaderboard: any[] }>(
        `/api/pools/${joinCode}/join`,
        {
          method: "POST",
          body: JSON.stringify({ displayName, stakeTxSignature, tempToken, passphrase }),
        },
      ),
    leaderboard: (joinCode: string) =>
      request<{ leaderboard: any[]; recentEvents: any[]; lastUpdated: string; poolStatus: string }>(
        `/api/pools/${joinCode}/leaderboard`,
      ),
  },

  teams: {
    getAll: (poolId?: string) =>
      request<{ teams: any[]; assignedTeamIds?: string[] }>(
        `/api/teams${poolId ? `?poolId=${poolId}` : ""}`,
      ),
  },

  fixtures: {
    get: (liveOnly = false) =>
      request<{ fixtures: any[] }>(`/api/fixtures${liveOnly ? "?live=true" : ""}`),
  },
};
