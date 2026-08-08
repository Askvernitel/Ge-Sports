import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/pubg_wager?replicaSet=rs0'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me-please'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me-please'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  SOLANA_RPC_URL: z.string().default('https://api.devnet.solana.com'),
  SOLANA_TOKEN_MINT: z.string().optional(),
  TREASURY_SECRET_KEY: z.string().optional(), // JSON array or base58, see chain/treasury.ts

  PUBG_API_KEY: z.string().optional(),
  PUBG_API_BASE_URL: z.string().default('https://api.pubg.com'),

  KYC_SHARED_SECRET: z.string().default('dev-kyc-webhook-secret'),
  KYC_MOCK_AUTO_APPROVE: z.coerce.boolean().default(true),

  FEATURE_DEV_FAUCET: z.coerce.boolean().default(true),
  FEATURE_DEPOSIT_POLLER: z.coerce.boolean().default(true),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  LOG_LEVEL: z.string().default('info'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
