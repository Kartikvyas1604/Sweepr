import { ZodError } from "zod";
import { logger } from "./logger";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiError(status: number, code: string, message: string) {
  return Response.json({ error: message, code, status }, { status });
}

export function handleRouteError(error: unknown): Response {
  if (error instanceof ApiError) {
    return apiError(error.status, error.code, error.message);
  }
  if (error instanceof ZodError) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      error.errors.map((e) => e.message).join(", "),
    );
  }
  logger.error("Unhandled route error", {
    error: error instanceof Error ? error.message : String(error),
  });
  return apiError(500, "INTERNAL_ERROR", "Something went wrong");
}
