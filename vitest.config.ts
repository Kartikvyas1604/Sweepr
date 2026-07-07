import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
    coverage: {
      provider: "v8",
      include: ["lib/auth.ts", "lib/env.ts", "lib/errors.ts", "lib/pools.ts", "lib/ratelimit.ts", "lib/scoring.ts", "lib/solana.ts", "lib/txline.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
