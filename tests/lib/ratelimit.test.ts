import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRateLimit } from "@/lib/ratelimit";
import { ApiError } from "@/lib/errors";

const mockLimit = vi.fn();

vi.mock("@/lib/redis", () => ({
  getRateLimiter: vi.fn(() => ({
    limit: mockLimit,
  })),
}));

describe("withRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows requests under the limit", async () => {
    mockLimit.mockResolvedValue({
      success: true,
      remaining: 4,
      limit: 5,
      reset: 1000,
    });
    const result = await withRateLimit(
      new Request("http://localhost:3000/api/test"),
      5,
      "1m",
    );
    expect(result.remaining).toBe(4);
  });

  it("throws ApiError 429 when rate limited", async () => {
    mockLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      limit: 5,
      reset: 1000,
    });
    await expect(
      withRateLimit(new Request("http://localhost:3000/api/test"), 5, "1m"),
    ).rejects.toThrow(ApiError);
    await expect(
      withRateLimit(new Request("http://localhost:3000/api/test"), 5, "1m"),
    ).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
  });

  it("uses provided identifier over IP", async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 9, limit: 10, reset: 0 });
    await withRateLimit(
      new Request("http://localhost:3000/api/test", {
        headers: { "x-real-ip": "1.2.3.4" },
      }),
      10,
      "1m",
      "custom-id",
    );
    const { getRateLimiter } = await import("@/lib/redis");
    expect(getRateLimiter).toHaveBeenCalledWith(
      expect.stringContaining("custom-id"),
      10,
      "1m",
    );
  });

  it("falls back to x-real-ip when no identifier provided", async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 9, limit: 10, reset: 0 });
    await withRateLimit(
      new Request("http://localhost:3000/api/test", {
        headers: { "x-real-ip": "1.2.3.4" },
      }),
      10,
      "1m",
    );
    const { getRateLimiter } = await import("@/lib/redis");
    expect(getRateLimiter).toHaveBeenCalledWith(
      expect.stringContaining("1.2.3.4"),
      10,
      "1m",
    );
  });

  it("falls back to x-forwarded-for when no x-real-ip", async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 9, limit: 10, reset: 0 });
    await withRateLimit(
      new Request("http://localhost:3000/api/test", {
        headers: { "x-forwarded-for": "5.6.7.8, 9.10.11.12" },
      }),
      10,
      "1m",
    );
    const { getRateLimiter } = await import("@/lib/redis");
    expect(getRateLimiter).toHaveBeenCalledWith(
      expect.stringContaining("5.6.7.8"),
      10,
      "1m",
    );
  });

  it("falls back to 'unknown' when no IP headers present", async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 9, limit: 10, reset: 0 });
    await withRateLimit(
      new Request("http://localhost:3000/api/test"),
      10,
      "1m",
    );
    const { getRateLimiter } = await import("@/lib/redis");
    expect(getRateLimiter).toHaveBeenCalledWith(
      expect.stringContaining("unknown"),
      10,
      "1m",
    );
  });

  it("fails open (returns default result) when redis errors", async () => {
    mockLimit.mockRejectedValue(new Error("Redis down"));
    const result = await withRateLimit(
      new Request("http://localhost:3000/api/test"),
      10,
      "1m",
    );
    expect(result.remaining).toBe(1);
    expect(result.limit).toBe(10);
  });
});
