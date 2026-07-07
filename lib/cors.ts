import { env } from "./env";

const allowedOrigins = [
  env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""),
  "http://localhost:3000",
  "http://localhost:3001",
];

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const allowed = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-inngest-key, x-request-id",
    "Access-Control-Max-Age": "86400",
  };
}

export function handleOptions(request: Request): Response | null {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }
  return null;
}
