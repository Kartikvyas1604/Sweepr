import { describe, it, expect, vi } from "vitest";
import { ApiError, apiError, handleRouteError } from "@/lib/errors";
import { ZodError, z } from "zod";

vi.mock("@/lib/cors", () => ({
  corsHeaders: vi.fn(() => ({})),
}));

describe("ApiError", () => {
  it("creates an instance with status and code", () => {
    const err = new ApiError(400, "BAD_REQUEST", "Invalid input");
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("Invalid input");
  });

  it("has correct name", () => {
    const err = new ApiError(401, "UNAUTHORIZED", "Missing auth");
    expect(err.name).toBe("ApiError");
  });
});

describe("apiError", () => {
  it("returns a Response with the correct status", () => {
    const res = apiError(404, "NOT_FOUND", "Not found");
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(404);
  });

  it("returns JSON body with error details", async () => {
    const res = apiError(400, "BAD_REQUEST", "Invalid input");
    const body = await res.json();
    expect(body).toEqual({
      error: "Invalid input",
      code: "BAD_REQUEST",
      status: 400,
    });
  });

  it("sets Content-Type header", () => {
    const res = apiError(500, "INTERNAL_ERROR", "Error");
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });
});

describe("handleRouteError", () => {
  it("returns ApiError response for ApiError instances", async () => {
    const err = new ApiError(400, "BAD_REQUEST", "bad request");
    const res = handleRouteError(err);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("BAD_REQUEST");
  });

  it("returns 400 for ZodError", async () => {
    const zodErr = new ZodError([{ message: "Invalid field", path: ["name"], code: z.ZodIssueCode.custom }] as any);
    const res = handleRouteError(zodErr);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 500 for unknown errors", async () => {
    const res = handleRouteError(new Error("crash"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL_ERROR");
  });

  it("returns 500 for non-Error throws", () => {
    const res = handleRouteError("string error" as any);
    expect(res.status).toBe(500);
  });

  it("does not leak internal error details", async () => {
    const res = handleRouteError(new Error("secret stacktrace"));
    const body = await res.json();
    expect(body.error).not.toContain("secret");
  });
});
