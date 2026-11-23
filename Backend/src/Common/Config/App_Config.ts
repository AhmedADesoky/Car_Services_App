import { z } from 'zod';

/** All runtime configuration, validated once at start-up. Values come from Backend/.env. */
const Env_Schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Runtime connection: role app_rw through the Supabase TRANSACTION pooler (port 6543)
  DATABASE_URL: z.string().startsWith('postgres'),
  DB_POOL_MAX: z.coerce.number().default(10),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().default(900),
  REFRESH_TTL_DAYS: z.coerce.number().default(30),
  // Server-side only. Used later for Supabase Storage signed URLs. Never sent to the apps.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
});

export type App_Config = z.infer<typeof Env_Schema>;

export function loadConfig(): App_Config {
  const parsed = Env_Schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid Backend/.env configuration:\n${issues}`);
  }
  return parsed.data;
}

export const APP_CONFIG = Symbol('APP_CONFIG');
