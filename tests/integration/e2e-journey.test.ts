import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/errors";

const redisStore = new Map<string, string>();

vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn((k: string, v: string, o?: any) => { redisStore.set(k, v); return Promise.resolve("OK"); }),
    get: vi.fn((k: string) => Promise.resolve(redisStore.get(k) ?? null)),
    del: vi.fn((k: string) => Promise.resolve(redisStore.delete(k) ? 1 : 0)),
    exists: vi.fn((k: string) => Promise.resolve(redisStore.has(k) ? 1 : 0)),
  },
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  publishPoolUpdate: vi.fn(),
}));

vi.mock("@/lib/txline", () => ({
  getAllTeams: vi.fn().mockResolvedValue([
    { id: "T1", name: "Team 1", shortName: "T1", flagUrl: "https://example.com/t1.png", group: "A", fifaRanking: 10 },
    { id: "T2", name: "Team 2", shortName: "T2", flagUrl: "https://example.com/t2.png", group: "B", fifaRanking: 20 },
  ]),
  getLiveFixtures: vi.fn().mockResolvedValue([
    { id: "f1", homeTeamId: "T1", awayTeamId: "T2", homeTeamName: "Team 1", awayTeamName: "Team 2", homeScore: 1, awayScore: 0, status: "live", kickoff: "2026-01-01T00:00:00Z", minute: 30, stage: "group", group: "A" },
  ]),
  getFixtureEvents: vi.fn().mockResolvedValue([
    { id: "evt_001", fixtureId: "f1", teamId: "T1", type: "goal", minute: 10, playerName: "Messi", detail: null },
  ]),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars!!",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
    UPSTASH_REDIS_REST_URL: "https://test.redis",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    TXLINE_API_KEY: "test-key",
    TXLINE_BASE_URL: "https://txline.test.com",
    SWEEPR_PROGRAM_ID: "6bvmJVnmogfwcVTrU9y6MaM9G8vYRQBXeHbiZw5BU2sC",
    SOLANA_NETWORK: "devnet",
    SETTLEMENT_KEYPAIR: "3fN7iMou8LUbMg23YyEiwstKQqfJPCFF7XJBMzTB6V3ZxgtdkKWHME5Q8hBz5K68wmwPuJUSdMjmxMt4FHx2Q6K8",
    ORACLE_PUBKEY: "EVmpTnRpuJhdGGyyDuV7gv7AuaK1XMErxcjp4nr4gJqb",
    INNGEST_EVENT_KEY: "test-ingest-key",
    INNGEST_SIGNING_KEY: "test-ingest-sign-key",
    PROTOCOL_FEE_WALLET: "ProtocolFeeWallet11111111111111111111111111111",
    NEXT_PUBLIC_SOLANA_RPC: "https://api.devnet.solana.com",
    JWT_EXPIRY: 86400,
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ wallet: "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr" }),
  verifyJWT: vi.fn().mockResolvedValue({ wallet: "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr" }),
  issueJWT: vi.fn().mockResolvedValue("mock-jwt"),
  verifyWalletSignature: vi.fn().mockResolvedValue(true),
  verifyAndConsumeNonce: vi.fn().mockResolvedValue(true),
  generateNonce: vi.fn().mockReturnValue("mock-nonce"),
  storeNonce: vi.fn().mockResolvedValue(undefined),
}));

const mockCallInitializePool = vi.fn().mockResolvedValue("mock-init-sig");
const mockCallSettlePool = vi.fn().mockResolvedValue("mock-settle-sig");

vi.mock("@/lib/solana", () => ({
  deriveEscrowPDA: vi.fn(() => ["EscrowPdaMock", 255]),
  callInitializePool: mockCallInitializePool,
  verifyJoinPoolTx: vi.fn().mockResolvedValue(true),
  callUpdateScore: vi.fn().mockResolvedValue("mock-score-sig"),
  callSettlePool: mockCallSettlePool,
  teamIdToBytes: vi.fn(() => Array.from(Buffer.alloc(8))),
  buildJoinPoolTx: vi.fn(),
  getUsdcMintForNetwork: vi.fn(),
}));

// In-memory tables for Supabase mock
const tables: Record<string, any[]> = { pools: [], pool_members: [], score_events: [], processed_nonces: [], onchain_retry_queue: [] };
let tableIdCounter = 0;

function makeQb(tableName: string) {
  let filters: Array<(r: any) => boolean> = [];
  const qb: any = {
    select: vi.fn(() => qb),
    eq: vi.fn((field: string, value: any) => {
      filters.push((r: any) => String(r[field]) === String(value));
      return qb;
    }),
    in: vi.fn((field: string, values: any[]) => {
      filters.push((r: any) => values.includes(r[field]));
      return qb;
    }),
    order: vi.fn(() => qb),
    limit: vi.fn(() => qb),
    maybeSingle: vi.fn(() => {
      const rows = tables[tableName] || [];
      const match = rows.find((r) => filters.every((f) => f(r)));
      return Promise.resolve({ data: match ?? null, error: null, count: null });
    }),
    single: vi.fn(() => {
      const rows = tables[tableName] || [];
      const match = rows.find((r) => filters.every((f) => f(r)));
      return Promise.resolve({ data: match ?? null, error: match ? null : { message: "Not found" }, count: null });
    }),
    insert: vi.fn((values: any) => {
      const record = { ...values, id: `rec_${++tableIdCounter}`, score: 0, rank: null, joined_at: new Date().toISOString() };
      if (!tables[tableName]) tables[tableName] = [];
      tables[tableName].push(record);
      const retQb = {
        ...qb,
        select: vi.fn(() => ({
          ...retQb,
          single: vi.fn(() => Promise.resolve({ data: record, error: null, count: null })),
        })),
      };
      return retQb;
    }),
    update: vi.fn((values: any) => {
      const applyUpdate = () => {
        const rows = tables[tableName] || [];
        let count = 0;
        for (const row of rows) {
          if (filters.length === 0 || filters.every((f) => f(row))) {
            Object.assign(row, values);
            count++;
          }
        }
        return count;
      };
      const updateQb = {
        eq: vi.fn((field: string, value: any) => {
          filters.push((r: any) => String(r[field]) === String(value));
          return updateQb;
        }),
        maybeSingle: vi.fn(() => {
          applyUpdate();
          return Promise.resolve({ data: null, error: null, count: 1 });
        }),
        then: vi.fn((onfulfilled: any) => {
          const count = applyUpdate();
          return Promise.resolve({ data: null, error: null, count }).then(onfulfilled);
        }),
      };
      return updateQb;
    }),
    then: vi.fn((onfulfilled: any) => {
      const rows = tables[tableName] || [];
      const filtered = filters.length > 0 ? rows.filter((r) => filters.every((f) => f(r))) : rows;
      const response = { data: filtered, error: null, count: filtered.length, status: 200, statusText: "OK" };
      return Promise.resolve(response).then(onfulfilled);
    }),
  };
  return qb;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => makeQb(table)),
    rpc: vi.fn((fn: string, args: any) => {
      if (fn === "increment_score") {
        const member = (tables.pool_members || []).find((m: any) => m.id === args.p_member_id);
        if (member) member.score = (member.score || 0) + args.p_points;
      }
      return Promise.resolve({ data: null, error: null });
    }),
  },
}));

const WALLET = "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr";

describe("E2E: full journey", () => {
  beforeEach(() => {
    tables.pools = [];
    tables.pool_members = [];
    tables.score_events = [];
    tables.processed_nonces = [];
    tables.onchain_retry_queue = [];
    redisStore.clear();
    tableIdCounter = 0;
    vi.clearAllMocks();
  });

  it("runs the full user journey", async () => {
    // ====== 1. CREATE POOL (unpaid) ======
    const { POST: createPool } = await import("@/app/api/pools/route");
    const createRes = await createPool(new Request("http://localhost:3000/api/pools", {
      method: "POST",
      body: JSON.stringify({ name: "World Cup 2026", entryFeeUsdc: 0, maxMembers: 10 }),
    }));
    expect(createRes.status).toBe(200);
    const { pool } = await createRes.json();
    expect(pool.status).toBe("waiting");

    // ====== 2. ASSIGN TEAM ======
    const { POST: assignTeam } = await import("@/app/api/pools/[joinCode]/assign-team/route");
    const assignRes = await assignTeam(
      new Request(`http://localhost:3000/api/pools/${pool.joinCode}/assign-team`, { method: "POST" }),
      { params: Promise.resolve({ joinCode: pool.joinCode }) },
    );
    expect(assignRes.status).toBe(200);
    const assignData = await assignRes.json();
    expect(assignData.tempToken).toBeTruthy();
    expect(assignData.team).toBeTruthy();

    // ====== 3. JOIN POOL ======
    const { POST: joinPool } = await import("@/app/api/pools/[joinCode]/join/route");
    const joinRes = await joinPool(
      new Request(`http://localhost:3000/api/pools/${pool.joinCode}/join`, {
        method: "POST",
        body: JSON.stringify({ displayName: "CryptoFan42", tempToken: assignData.tempToken }),
      }),
      { params: Promise.resolve({ joinCode: pool.joinCode }) },
    );
    expect(joinRes.status).toBe(200);
    const joinData = await joinRes.json();
    expect(joinData.member.wallet).toBe(WALLET);
    expect(joinData.member.displayName).toBe("CryptoFan42");
    expect(joinData.member.score).toBe(0);

    // ====== 4. CHECK LEADERBOARD ======
    const { GET: getLeaderboard } = await import("@/app/api/pools/[joinCode]/leaderboard/route");
    const lbRes = await getLeaderboard(
      new Request(`http://localhost:3000/api/pools/${pool.joinCode}/leaderboard`),
      { params: Promise.resolve({ joinCode: pool.joinCode }) },
    );
    expect(lbRes.status).toBe(200);
    const lb = await lbRes.json();
    expect(lb.leaderboard).toHaveLength(1);
    expect(lb.leaderboard[0].rank).toBe(1);

    // ====== 5. SCORE SYNC (simulate Inngest webhook) ======
    const { POST: scoreSync } = await import("@/app/api/internal/score-sync/route");
    const syncReq = new Request("http://localhost:3000/api/internal/score-sync", {
      method: "POST",
      headers: { "x-inngest-key": "test-ingest-key" },
    });
    const syncRes = await scoreSync(syncReq);
    expect(syncRes.status).toBe(200);
    const syncData = await syncRes.json();
    expect(syncData.newGoals).toBe(1);
    expect(syncData.poolsProcessed).toBe(1);

    // ====== 6. VERIFY SCORE UPDATED ======
    const lbRes2 = await getLeaderboard(
      new Request(`http://localhost:3000/api/pools/${pool.joinCode}/leaderboard`),
      { params: Promise.resolve({ joinCode: pool.joinCode }) },
    );
    const lb2 = await lbRes2.json();
    expect(lb2.leaderboard[0].score).toBeGreaterThan(0);

    // ====== 7. SETTLE POOL ======
    const { POST: settlePool } = await import("@/app/api/internal/settle/route");
    const settleReq = new Request("http://localhost:3000/api/internal/settle", {
      method: "POST",
      headers: { "x-inngest-key": "test-ingest-key" },
    });
    const settleRes = await settlePool(settleReq);
    expect(settleRes.status).toBe(200);
    const settleData = await settleRes.json();
    expect(settleData.settled).toBe(1);

    // ====== 8. VERIFY POOL SETTLED ======
    const poolInDb = tables.pools.find((p: any) => p.id === pool.id);
    expect(poolInDb).toBeTruthy();
    expect(poolInDb.status).toBe("settled");
    expect(poolInDb.winner_wallet).toBe(WALLET);

    // ====== 9. VERIFY SETTLED POOL REJECTS NEW JOINS ======
    const { POST: joinAgain } = await import("@/app/api/pools/[joinCode]/join/route");
    const rejectRes = await joinAgain(
      new Request(`http://localhost:3000/api/pools/${pool.joinCode}/join`, {
        method: "POST",
        body: JSON.stringify({ displayName: "LateUser" }),
      }),
      { params: Promise.resolve({ joinCode: pool.joinCode }) },
    );
    expect(rejectRes.status).toBe(409);
  });

  it("creates a paid pool with fee, verifies on-chain init called", async () => {
    const { POST: createPool } = await import("@/app/api/pools/route");
    const createRes = await createPool(new Request("http://localhost:3000/api/pools", {
      method: "POST",
      body: JSON.stringify({ name: "Premium Pool", entryFeeUsdc: 5, maxMembers: 20 }),
    }));
    expect(createRes.status).toBe(200);
    const { pool } = await createRes.json();

    // The pool.id is set by crypto.randomUUID() — it's a real UUID, not a mock rec_*
    expect(pool.id).toBeTruthy();
    expect(mockCallInitializePool).toHaveBeenCalledWith(expect.any(String), 5, 20);
    expect(pool.status).toBe("waiting");
  });

  it("returns 401 unauthorized when no auth header", async () => {
    const { requireAuth } = await import("@/lib/auth");
    vi.mocked(requireAuth).mockRejectedValueOnce(new ApiError(401, "Unauthorized", "No auth"));

    const { POST: createPool } = await import("@/app/api/pools/route");
    const res = await createPool(new Request("http://localhost:3000/api/pools", {
      method: "POST",
      body: JSON.stringify({ name: "Test", entryFeeUsdc: 0, maxMembers: 5 }),
    }));
    expect(res.status).toBe(401);
  });
});
