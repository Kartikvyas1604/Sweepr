import { describe, it, expect, vi, beforeEach } from "vitest";

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
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ wallet: "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr" }),
}));

vi.mock("@/lib/solana", () => ({
  deriveEscrowPDA: vi.fn(() => ["EscrowPdaMock", 255]),
  callInitializePool: vi.fn().mockResolvedValue("mock-init-sig"),
  verifyJoinPoolTx: vi.fn().mockResolvedValue(true),
  callUpdateScore: vi.fn().mockResolvedValue("mock-score-sig"),
  callSettlePool: vi.fn().mockResolvedValue("mock-settle-sig"),
  teamIdToBytes: vi.fn(() => Array.from(Buffer.alloc(8))),
}));

// In-memory tables
const tables: Record<string, any[]> = { pools: [], pool_members: [] };
let idCounter = 0;

function buildQb(tableName: string) {
  const filters: Array<(r: any) => boolean> = [];
  const qb: any = {
    select: vi.fn(() => qb),
    eq: vi.fn((field: string, value: any) => {
      filters.push((r: any) => String(r[field]) === String(value));
      return qb;
    }),
    order: vi.fn(() => qb),
    limit: vi.fn(() => qb),
    single: vi.fn(() => {
      const rows = tables[tableName] ?? [];
      const match = rows.find((r) => filters.every((f) => f(r)));
      return Promise.resolve({ data: match ?? null, error: match ? null : { message: "Not found" }, count: null });
    }),
    maybeSingle: vi.fn(() => {
      const rows = tables[tableName] ?? [];
      const match = rows.find((r) => filters.every((f) => f(r)));
      return Promise.resolve({ data: match ?? null, error: null, count: null });
    }),
    insert: vi.fn((values: any) => {
      const record = { ...values, id: `rec_${++idCounter}`, score: 0, joined_at: new Date().toISOString() };
      if (!tables[tableName]) tables[tableName] = [];
      tables[tableName].push(record);
      const retQb = { ...qb, select: vi.fn(() => ({ ...retQb, single: vi.fn(() => Promise.resolve({ data: record, error: null, count: null })) })) };
      return retQb;
    }),
    update: vi.fn((values: any) => {
      const applyUpdate = () => {
        const rows = tables[tableName] ?? [];
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
      const rows = tables[tableName] ?? [];
      return Promise.resolve({ data: filters.length > 0 ? rows.filter((r) => filters.every((f) => f(r))) : rows, error: null, count: rows.length }).then(onfulfilled);
    }),
  };
  return qb;
}

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => buildQb(table)),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}));

import { requireAuth } from "@/lib/auth";
const WALLET = "6AJRnhRJoFZ9MpjguhAjt5k3KYH2BbBfLvs4PsuAzYwr";

describe("pool CRUD flow", () => {
  beforeEach(() => {
    tables.pools = [];
    tables.pool_members = [];
    redisStore.clear();
    idCounter = 0;
    vi.clearAllMocks();
  });

  it("creates a free pool, assigns team, joins, and gets leaderboard", async () => {
    const { POST: createPool } = await import("@/app/api/pools/route");
    const createRes = await createPool(new Request("http://localhost:3000/api/pools", {
      method: "POST",
      body: JSON.stringify({ name: "World Cup Pool", entryFeeUsdc: 0, maxMembers: 5 }),
    }));
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.pool.name).toBe("World Cup Pool");
    expect(created.pool.status).toBe("waiting");
    const joinCode = created.pool.joinCode;

    const { POST: assignTeam } = await import("@/app/api/pools/[joinCode]/assign-team/route");
    const assignRes = await assignTeam(
      new Request(`http://localhost:3000/api/pools/${joinCode}/assign-team`, { method: "POST" }),
      { params: Promise.resolve({ joinCode }) },
    );
    expect(assignRes.status).toBe(200);
    const assigned = await assignRes.json();
    expect(assigned.tempToken).toBeTruthy();
    expect(assigned.team).toBeTruthy();

    const { POST: joinPool } = await import("@/app/api/pools/[joinCode]/join/route");
    const joinRes = await joinPool(
      new Request(`http://localhost:3000/api/pools/${joinCode}/join`, {
        method: "POST",
        body: JSON.stringify({ displayName: "TestUser", tempToken: assigned.tempToken }),
      }),
      { params: Promise.resolve({ joinCode }) },
    );
    expect(joinRes.status).toBe(200);
    const joined = await joinRes.json();
    expect(joined.member.wallet).toBe(WALLET);
    expect(joined.member.displayName).toBe("TestUser");
    expect(joined.member.score).toBe(0);

    const { GET: getLeaderboard } = await import("@/app/api/pools/[joinCode]/leaderboard/route");
    const lbRes = await getLeaderboard(
      new Request(`http://localhost:3000/api/pools/${joinCode}/leaderboard`),
      { params: Promise.resolve({ joinCode }) },
    );
    expect(lbRes.status).toBe(200);
    const lb = await lbRes.json();
    expect(lb.leaderboard).toHaveLength(1);
    expect(lb.leaderboard[0].wallet).toBe(WALLET);
    expect(lb.leaderboard[0].rank).toBe(1);
  });

  it("rejects duplicate join attempt", async () => {
    const { POST: createPool } = await import("@/app/api/pools/route");
    const createRes = await createPool(new Request("http://localhost:3000/api/pools", {
      method: "POST",
      body: JSON.stringify({ name: "Test", entryFeeUsdc: 0, maxMembers: 5 }),
    }));
    const { pool } = await createRes.json();

    const { POST: joinPool } = await import("@/app/api/pools/[joinCode]/join/route");
    const joinReq = new Request(`http://localhost:3000/api/pools/${pool.joinCode}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName: "User1" }),
    });
    const joinRes = await joinPool(joinReq, { params: Promise.resolve({ joinCode: pool.joinCode }) });
    expect(joinRes.status).toBe(200);

    const joinReq2 = new Request(`http://localhost:3000/api/pools/${pool.joinCode}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName: "User1" }),
    });
    const joinRes2 = await joinPool(joinReq2, { params: Promise.resolve({ joinCode: pool.joinCode }) });
    expect(joinRes2.status).toBe(409);
    const err = await joinRes2.json();
    expect(err.code).toBe("ALREADY_JOINED");
  });

  it("rejects join when pool is full", async () => {
    const { POST: createPool } = await import("@/app/api/pools/route");
    const createRes = await createPool(new Request("http://localhost:3000/api/pools", {
      method: "POST",
      body: JSON.stringify({ name: "Full Pool", entryFeeUsdc: 0, maxMembers: 2 }),
    }));
    expect(createRes.status).toBe(200);
    const { pool } = await createRes.json();

    // Pre-fill pool_members so pool appears full
    tables.pool_members.push(
      { id: "m1", pool_id: pool.id, wallet: WALLET, team_id: "T1", display_name: "User1", score: 0, rank: 1 },
      { id: "m2", pool_id: pool.id, wallet: "OtherWallet1", team_id: "T2", display_name: "User2", score: 0, rank: 2 },
    );

    // Mock requireAuth to return a different wallet for this attempt
    vi.mocked(requireAuth).mockResolvedValue({ wallet: "ThirdWallet111111111111111111111111111111111" });

    const { POST: joinPool } = await import("@/app/api/pools/[joinCode]/join/route");
    const joinReq = new Request(`http://localhost:3000/api/pools/${pool.joinCode}/join`, {
      method: "POST",
      body: JSON.stringify({ displayName: "User3" }),
    });
    const joinRes = await joinPool(joinReq, { params: Promise.resolve({ joinCode: pool.joinCode }) });
    expect(joinRes.status).toBe(409);
    const err = await joinRes.json();
    expect(err.code).toBe("POOL_FULL");
  });
});
