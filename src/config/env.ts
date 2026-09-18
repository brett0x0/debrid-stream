import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(7000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ADDON_URL: z.string().url().default('http://localhost:7000'),
  SECRET_KEY: z.string().min(16).default('debrid-stream-secret-key-32-chars-long!'),
  REDIS_URL: z.string().optional(),
  RD_REQUEST_TIMEOUT_MS: z.coerce.number().default(4000),
  PROVIDER_TIMEOUT_MS: z.coerce.number().default(2500),
  MAX_PARALLEL_PROVIDERS: z.coerce.number().default(6),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
