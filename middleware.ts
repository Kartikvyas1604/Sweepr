import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, ""),
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean) as string[];

const MAX_BODY_SIZE = 100_000;

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();

  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.method !== "OPTIONS"
  ) {
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "Request body too large", code: "PAYLOAD_TOO_LARGE", status: 413 },
        { status: 413 },
      );
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-request-id", requestId);

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") ?? "";
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] ?? "*";

    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods":
            "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, x-inngest-key, x-request-id",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-inngest-key, x-request-id",
    );
    response.headers.set("Access-Control-Max-Age", "86400");
  }

  const url = request.nextUrl.pathname;
  const method = request.method;
  const wallet = request.headers.get("authorization")?.slice(0, 20) ?? "none";

  logger.info("request", {
    requestId,
    method,
    path: url,
    wallet: wallet.length > 10 ? `${wallet}...` : wallet,
  });

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
