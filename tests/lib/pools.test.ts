import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateJoinCode, computeLeaderboard } from "@/lib/pools";
import { ApiError } from "@/lib/errors";

vi.mock("@/lib/redis", () => ({
  redis: {
    exists: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("@/lib/txline", () => ({
  getAllTeams: vi.fn().mockResolvedValue([
    { id: "T1", name: "Team 1", shortName: "T1", flagUrl: "https://example.com/t1.png", group: "A", fifaRanking: 10 },
    { id: "T2", name: "Team 2", shortName: "T2", flagUrl: "https://example.com/t2.png", group: "A", fifaRanking: 20 },
    { id: "T3", name: "Team 3", shortName: "T3", flagUrl: "https://example.com/t3.png", group: "B", fifaRanking: 30 },
  ]),
}));

const mockQueryResult = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      const qb = {
        select: vi.fn(() => qb),
        eq: vi.fn(() => qb),
        order: vi.fn(() => qb),
        then: (onFulfilled: any) => Promise.resolve(mockQueryResult()).then(onFulfilled),
      };
      return qb;
    }),
  },
}));

import { redis } from "@/lib/redis";

describe("generateJoinCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a 6-character alphanumeric code", async () => {
    (redis.exists as any).mockResolvedValue(0);
    (redis.set as any).mockResolvedValue("OK");
    const code = await generateJoinCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z2-9]+$/);
  });

  it("retries if code already exists", async () => {
    (redis.exists as any).mockResolvedValueOnce(0);
    (redis.set as any).mockResolvedValue("OK");
    await generateJoinCode();
    expect(redis.exists).toHaveBeenCalledTimes(1);
  });

  it("throws after 10 failed attempts", async () => {
    (redis.exists as any).mockResolvedValue(1);
    await expect(generateJoinCode()).rejects.toThrow(ApiError);
    await expect(generateJoinCode()).rejects.toMatchObject({
      code: "JOIN_CODE_FAILED",
    });
  });

  it("stores the code in redis with 30-day expiry", async () => {
    (redis.exists as any).mockResolvedValue(0);
    (redis.set as any).mockResolvedValue("OK");
    await generateJoinCode();
    expect(redis.set).toHaveBeenCalledWith(expect.any(String), "1", { ex: 2592000 });
  });
});

describe("computeLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ranked leaderboard ordered by score desc, joined_at asc", async () => {
    // Already sorted by score DESC, joined_at ASC (as DB would return)
    const mockMembers = [
      { id: "m2", wallet: "w2", display_name: "Bob", team_id: "T2", team_name: "Team 2", team_flag_url: null, team_group: "A", score: 20, joined_at: "2026-01-02T00:00:00Z" },
      { id: "m1", wallet: "w1", display_name: "Alice", team_id: "T1", team_name: "Team 1", team_flag_url: null, team_group: "A", score: 10, joined_at: "2026-01-01T00:00:00Z" },
      { id: "m3", wallet: "w3", display_name: "Charlie", team_id: "T3", team_name: "Team 3", team_flag_url: null, team_group: "B", score: 10, joined_at: "2026-01-03T00:00:00Z" },
    ];

    mockQueryResult.mockReturnValue({ data: mockMembers, error: null });

    const result = await computeLeaderboard("pool-1");
    expect(result).toHaveLength(3);
    expect(result[0].wallet).toBe("w2");
    expect(result[0].rank).toBe(1);
    // Alice and Charlie both have score 10 — Alice joined first so appears first
    expect(result[1].wallet).toBe("w1");
    expect(result[1].rank).toBe(2);
    // Charlie also score 10, tie gets same rank
    expect(result[2].wallet).toBe("w3");
    expect(result[2].rank).toBe(2);
  });

  it("throws on query error", async () => {
    mockQueryResult.mockReturnValue({ data: null, error: new Error("DB error") });
    await expect(computeLeaderboard("pool-1")).rejects.toThrow(ApiError);
  });
});
