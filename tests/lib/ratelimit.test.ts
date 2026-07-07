import { describe, it, expect, vi, beforeEach } from "vitest";
import { withRateLimit } from "@/lib/ratelimit";

const mockLimit = vi.fn().mockResolvedValue({ success: true, remaining: 9, limit: 10, reset: 100 });

vi.mock("@/lib/redis", () => ({
  getRateLimiter: vi.fn(() => ({ limit: mockLimit })),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "test",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  },
}));

vi.mock("@/lib/cors", () => ({
  corsHeaders: vi.fn(() => ({})),
  handleOptions: vi.fn(() => null),
}));

function makeRequest(ip?: string): Request {
  const headers: Record<string, string> = {};
  if (ip) headers["x-real-ip"] = ip;
  return new Request("http://localhost:3000/api/test", { headers });
}

describe("withRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns result with remaining and limit when under limit", async () => {
    const result = await withRateLimit(makeRequest("127.0.0.1"), 10, "1m");
    expect(result.remaining).toBe(9);
    expect(result.limit).toBe(10);
    expect(result.reset).toBe(100);
  });

  it("throws ApiError 429 when rate limited", async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0, limit: 10, reset: 100 });
    await expect(withRateLimit(makeRequest("127.0.0.1"), 10, "1m")).rejects.toThrow();
  });

  it("extracts IP from x-real-ip header", async () => {
    const { getRateLimiter } = await import("@/lib/redis");
    await withRateLimit(makeRequest("192.168.1.1"), 10, "1m");
    expect(getRateLimiter).toHaveBeenCalled();
  });

  it("uses x-forwarded-for when x-real-ip is absent", async () => {
    const { getRateLimiter } = await import("@/lib/redis");
    const req = new Request("http://localhost:3000/api/test", {
      headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
    });
    await withRateLimit(req, 10, "1m");
    expect(getRateLimiter).toHaveBeenCalled();
  });

  it("fails open when Redis errors and request passes through", async () => {
    const { getRateLimiter } = await import("@/lib/redis");
    vi.mocked(getRateLimiter).mockImplementation(() => {
      throw new Error("Redis unreachable");
    });
    const result = await withRateLimit(makeRequest("127.0.0.1"), 10, "1m");
    expect(result.remaining).toBe(1);
    expect(result.limit).toBe(10);
  });

  it("uses custom identifier when provided", async () => {
    const { getRateLimiter } = await import("@/lib/redis");
    await withRateLimit(makeRequest("127.0.0.1"), 10, "1m", "custom-user-id");
    expect(getRateLimiter).toHaveBeenCalled();
  });
});
