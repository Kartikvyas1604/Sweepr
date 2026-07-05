import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, ""),
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean) as string[];

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();

  // Inject request ID for log correlation
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("x-request-id", requestId);

  // CORS enforcement on API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") ?? "";
    const isInternal =
      !origin ||
      ALLOWED_ORIGINS.includes(origin) ||
      origin.includes("localhost");

    if (!isInternal && request.method !== "OPTIONS") {
      return NextResponse.json(
        { error: "CORS: origin not allowed", code: "CORS_ERROR", status: 403 },
        { status: 403 },
      );
    }

    const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] ?? "";

    // Add CORS headers
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

    // Handle preflight
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
  }

  // Log every request
  const url = request.nextUrl.pathname;
  const method = request.method;
  const wallet = request.headers.get("authorization")?.slice(0, 20) ?? "none";

  console.log(
    JSON.stringify({
      level: "info",
      message: "request",
      timestamp: new Date().toISOString(),
      requestId,
      method,
      path: url,
      wallet: wallet.length > 10 ? `${wallet}...` : wallet,
    }),
  );

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
