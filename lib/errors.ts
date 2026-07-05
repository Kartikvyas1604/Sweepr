import { ZodError } from "zod";
import { logger } from "./logger";
import { corsHeaders } from "./cors";
}

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

export function apiError(
  status: number,
  code: string,
  message: string,
  request?: Request,
) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (request) {
    const cors = corsHeaders(request);
    for (const [key, value] of Object.entries(cors)) {
      headers.set(key, value);
    }
  }
  return new Response(
    JSON.stringify({ error: message, code, status }),
    { status, headers },
  );
}

export function handleRouteError(error: unknown, request?: Request): Response {
  if (error instanceof ApiError) {
    return apiError(error.status, error.code, error.message, request);
  }
  if (error instanceof ZodError) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      error.errors.map((e) => e.message).join(", "),
      request,
    );
  }
  logger.error("Unhandled route error", {
    error: error instanceof Error ? error.message : String(error),
  });
  return apiError(500, "INTERNAL_ERROR", "Something went wrong", request);
}
