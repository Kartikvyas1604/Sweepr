import { describe, it, expect, vi } from "vitest";
import { ApiError, apiError, handleRouteError } from "@/lib/errors";
import { z } from "zod";

vi.mock("@/lib/cors", () => ({
  corsHeaders: vi.fn().mockReturnValue({
    "Access-Control-Allow-Origin": "*",
  }),
}));

describe("ApiError", () => {
  it("creates an error with status, code, and message", () => {
    const err = new ApiError(404, "NOT_FOUND", "Pool not found");
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Pool not found");
    expect(err.name).toBe("ApiError");
  });
});

describe("apiError", () => {
  it("returns a Response with error JSON", () => {
    const res = apiError(400, "BAD_REQUEST", "Invalid input");
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    return res.json().then((body) => {
      expect(body).toEqual({
        error: "Invalid input",
        code: "BAD_REQUEST",
        status: 400,
      });
    });
  });

  it("includes CORS headers when request is provided", () => {
    const req = new Request("http://localhost:3000");
    const res = apiError(500, "ERR", "msg", req);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("handleRouteError", () => {
  it("returns ApiError response for ApiError instances", () => {
    const err = new ApiError(403, "FORBIDDEN", "Access denied");
    const res = handleRouteError(err);
    expect(res.status).toBe(403);
  });

  it("returns 400 for ZodError", () => {
    let zodError: z.ZodError;
    try {
      z.string().parse(123);
    } catch (e) {
      zodError = e as z.ZodError;
      const res = handleRouteError(zodError);
      expect(res.status).toBe(400);
    }
  });

  it("returns 500 for unknown errors", () => {
    const res = handleRouteError(new Error("something broke"));
    expect(res.status).toBe(500);
  });

  it("returns 500 for non-Error values", () => {
    const res = handleRouteError("string error");
    expect(res.status).toBe(500);
  });
});
