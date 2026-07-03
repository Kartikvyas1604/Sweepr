import { corsHeaders } from "./cors";

export function jsonResponse(
  data: unknown,
  init?: ResponseInit,
  request?: Request,
): Response {
  const headers = new Headers(init?.headers);
  if (request) {
    const cors = corsHeaders(request);
    for (const [key, value] of Object.entries(cors)) {
      headers.set(key, value);
    }
  }
  return Response.json(data, { ...init, headers });
}
