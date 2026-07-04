import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  TXLINE_API_KEY: z.string().optional(),
  TXLINE_BASE_URL: z.string().url().default("https://txline.txodds.com"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRY: z.coerce.number().positive().default(86400),
  SETTLEMENT_KEYPAIR: z.string().min(1),
  ORACLE_PUBKEY: z.string().min(1),
  PROTOCOL_FEE_WALLET: z.string().min(1),
  NEXT_PUBLIC_SOLANA_RPC: z.string().url(),
  SOLANA_NETWORK: z.enum(["mainnet-beta", "devnet", "testnet"]).default("mainnet-beta"),
  SWEEPR_PROGRAM_ID: z.string().min(1),
  INNGEST_EVENT_KEY: z.string().min(1),
  INNGEST_SIGNING_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.errors
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join("\n  ");
  throw new Error(`Missing env var: ${missing}`);
}

export const env = parsed.data;
