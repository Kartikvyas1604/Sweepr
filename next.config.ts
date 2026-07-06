const RPC_URLS = (process.env.NEXT_PUBLIC_SOLANA_RPC ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CONNECT_SRC = ["'self'", ...RPC_URLS].join(" ");

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src ${CONNECT_SRC}; font-src 'self' data:;`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
