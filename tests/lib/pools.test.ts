import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateJoinCode, computeLeaderboard } from "@/lib/pools";
import { ApiError } from "@/lib/errors";

const mockTxlineTeams = vi.hoisted(() => [
  { id: "BRA", name: "Brazil", shortName: "Brazil", flagUrl: "", group: "A", fifaRanking: 1 },
  { id: "ARG", name: "Argentina", shortName: "Argentina", flagUrl: "", group: "A", fifaRanking: 2 },
  { id: "FRA", name: "France", shortName: "France", flagUrl: "", group: "B", fifaRanking: 3 },
  { id: "ENG", name: "England", shortName: "England", flagUrl: "", group: "B", fifaRanking: 4 },
]);

vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "test",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}));

vi.mock("@/lib/cors", () => ({
  corsHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    exists: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("@/lib/txline", () => ({
  getAllTeams: vi.fn().mockResolvedValue(mockTxlineTeams),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      const qb: any = {
        select: vi.fn(() => qb),
        eq: vi.fn(() => qb),
        order: vi.fn(() => qb),
        in: vi.fn(() => qb),
        limit: vi.fn(() => qb),
        single: vi.fn(() => qb),
      };
      qb.then = (onFulfilled: any) => Promise.resolve(qb._mockResult ?? { data: [], error: null }).then(onFulfilled);
      return qb;
    }),
  },
}));

import { redis } from "@/lib/redis";

describe("generateJoinCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns exactly 6 uppercase alphanumeric characters", async () => {
    (redis.exists as any).mockResolvedValue(0);
    (redis.set as any).mockResolvedValue("OK");
    const code = await generateJoinCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it("only uses characters from JOIN_CODE_CHARS", async () => {
    (redis.exists as any).mockResolvedValue(0);
    (redis.set as any).mockResolvedValue("OK");
    const code = await generateJoinCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });

  it("retries on Redis collision and returns a different code", async () => {
    (redis.exists as any).mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    (redis.set as any).mockResolvedValue("OK");
    const code = await generateJoinCode();
    expect(code).toHaveLength(6);
    expect(redis.exists).toHaveBeenCalledTimes(2);
  });

  it("throws ApiError if collision limit exceeded", async () => {
    (redis.exists as any).mockResolvedValue(1);
    await expect(generateJoinCode()).rejects.toThrow(ApiError);
  });
});

describe("computeLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orders members by score descending", async () => {
    const { supabaseAdmin } = await import("@/lib/supabase");
    const mockData = [
      { id: "m1", wallet: "w1", display_name: "Alice", team_id: "BRA", team_name: "Brazil", team_flag_url: null, team_group: "A", score: 15, joined_at: "2026-01-01T00:00:00Z" },
      { id: "m2", wallet: "w2", display_name: "Bob", team_id: "ARG", team_name: "Argentina", team_flag_url: null, team_group: "A", score: 10, joined_at: "2026-01-02T00:00:00Z" },
      { id: "m3", wallet: "w3", display_name: "Charlie", team_id: "FRA", team_name: "France", team_flag_url: null, team_group: "B", score: 5, joined_at: "2026-01-03T00:00:00Z" },
    ];

    supabaseAdmin.from = vi.fn(() => {
      const qb: any = { select: vi.fn(() => qb), eq: vi.fn(() => qb), order: vi.fn(() => qb), single: vi.fn(() => qb) };
      qb._mockResult = { data: mockData, error: null };
      qb.then = (onFulfilled: any) => Promise.resolve(qb._mockResult).then(onFulfilled);
      return qb;
    }) as any;

    const result = await computeLeaderboard("pool-1");
    expect(result[0].score).toBe(15);
    expect(result[1].score).toBe(10);
    expect(result[2].score).toBe(5);
  });

  it("assigns rank 1 to the highest scorer", async () => {
    const { supabaseAdmin } = await import("@/lib/supabase");
    supabaseAdmin.from = vi.fn(() => {
      const qb: any = { select: vi.fn(() => qb), eq: vi.fn(() => qb), order: vi.fn(() => qb), single: vi.fn(() => qb) };
      qb._mockResult = { data: [{ id: "m1", wallet: "w1", display_name: "Alice", team_id: "BRA", team_name: "Brazil", team_flag_url: null, team_group: "A", score: 10, joined_at: "2026-01-01T00:00:00Z" }], error: null };
      qb.then = (onFulfilled: any) => Promise.resolve(qb._mockResult).then(onFulfilled);
      return qb;
    }) as any;

    const result = await computeLeaderboard("pool-1");
    expect(result[0].rank).toBe(1);
  });

  it("gives same rank to tied members", async () => {
    const { supabaseAdmin } = await import("@/lib/supabase");
    supabaseAdmin.from = vi.fn(() => {
      const qb: any = { select: vi.fn(() => qb), eq: vi.fn(() => qb), order: vi.fn(() => qb), single: vi.fn(() => qb) };
      qb._mockResult = { data: [
        { id: "m1", wallet: "w1", display_name: "Alice", team_id: "BRA", team_name: "Brazil", team_flag_url: null, team_group: "A", score: 9, joined_at: "2026-01-01T00:00:00Z" },
        { id: "m2", wallet: "w2", display_name: "Bob", team_id: "ARG", team_name: "Argentina", team_flag_url: null, team_group: "A", score: 9, joined_at: "2026-01-02T00:00:00Z" },
      ], error: null };
      qb.then = (onFulfilled: any) => Promise.resolve(qb._mockResult).then(onFulfilled);
      return qb;
    }) as any;

    const result = await computeLeaderboard("pool-1");
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(1);
  });

  it("skips rank numbers correctly for ties (1, 1, 3)", async () => {
    const { supabaseAdmin } = await import("@/lib/supabase");
    supabaseAdmin.from = vi.fn(() => {
      const qb: any = { select: vi.fn(() => qb), eq: vi.fn(() => qb), order: vi.fn(() => qb), single: vi.fn(() => qb) };
      qb._mockResult = { data: [
        { id: "m1", wallet: "w1", display_name: "Alice", team_id: "BRA", team_name: "Brazil", team_flag_url: null, team_group: "A", score: 9, joined_at: "2026-01-01T00:00:00Z" },
        { id: "m2", wallet: "w2", display_name: "Bob", team_id: "ARG", team_name: "Argentina", team_flag_url: null, team_group: "A", score: 9, joined_at: "2026-01-02T00:00:00Z" },
        { id: "m3", wallet: "w3", display_name: "Charlie", team_id: "FRA", team_name: "France", team_flag_url: null, team_group: "B", score: 5, joined_at: "2026-01-03T00:00:00Z" },
      ], error: null };
      qb.then = (onFulfilled: any) => Promise.resolve(qb._mockResult).then(onFulfilled);
      return qb;
    }) as any;

    const result = await computeLeaderboard("pool-1");
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(1);
    expect(result[2].rank).toBe(3);
  });

  it("uses joined_at as tiebreaker (earlier join = higher position)", async () => {
    const { supabaseAdmin } = await import("@/lib/supabase");
    supabaseAdmin.from = vi.fn(() => {
      const qb: any = { select: vi.fn(() => qb), eq: vi.fn(() => qb), order: vi.fn(() => qb), single: vi.fn(() => qb) };
      qb._mockResult = { data: [
        { id: "m1", wallet: "w1", display_name: "Alice", team_id: "BRA", team_name: "Brazil", team_flag_url: null, team_group: "A", score: 5, joined_at: "2026-01-01T00:00:00Z" },
        { id: "m2", wallet: "w2", display_name: "Bob", team_id: "ARG", team_name: "Argentina", team_flag_url: null, team_group: "A", score: 5, joined_at: "2026-01-03T00:00:00Z" },
      ], error: null };
      qb.then = (onFulfilled: any) => Promise.resolve(qb._mockResult).then(onFulfilled);
      return qb;
    }) as any;

    const result = await computeLeaderboard("pool-1");
    expect(result[0].wallet).toBe("w1");
    expect(result[1].wallet).toBe("w2");
  });

  it("returns empty array for pool with no members", async () => {
    const { supabaseAdmin } = await import("@/lib/supabase");
    supabaseAdmin.from = vi.fn(() => {
      const qb: any = { select: vi.fn(() => qb), eq: vi.fn(() => qb), order: vi.fn(() => qb), single: vi.fn(() => qb) };
      qb._mockResult = { data: [], error: null };
      qb.then = (onFulfilled: any) => Promise.resolve(qb._mockResult).then(onFulfilled);
      return qb;
    }) as any;

    const result = await computeLeaderboard("pool-1");
    expect(result).toHaveLength(0);
  });

  it("throws on query error", async () => {
    const { supabaseAdmin } = await import("@/lib/supabase");
    supabaseAdmin.from = vi.fn(() => {
      const qb: any = { select: vi.fn(() => qb), eq: vi.fn(() => qb), order: vi.fn(() => qb), single: vi.fn(() => qb) };
      qb._mockResult = { data: null, error: new Error("DB error") };
      qb.then = (onFulfilled: any) => Promise.resolve(qb._mockResult).then(onFulfilled);
      return qb;
    }) as any;

    await expect(computeLeaderboard("pool-1")).rejects.toThrow(ApiError);
  });
});
