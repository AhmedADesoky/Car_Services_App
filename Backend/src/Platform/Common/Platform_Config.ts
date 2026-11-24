import { z } from 'zod';

/** Configuration of the Admin Console API (separate process: npm run start:platform). */
const Platform_Env_Schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PLATFORM_PORT: z.coerce.number().default(3001),
  PLATFORM_DATABASE_URL: z.string().startsWith('postgres'),
  PLATFORM_JWT_SECRET: z.string().min(32, 'PLATFORM_JWT_SECRET must be at least 32 characters'),
  PLATFORM_ENCRYPTION_KEY: z.string().refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes in base64'),
  PLATFORM_ALLOWED_IPS: z.string().default(''),
  PLATFORM_ALLOW_ANY_IP: z.enum(['true', 'false']).default('false'),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:3002'),
  PLATFORM_ACCESS_TTL_SECONDS: z.coerce.number().default(900),      // 15 min
  PLATFORM_REFRESH_TTL_HOURS: z.coerce.number().default(12),        // staff sessions end every working day
  OWNER_INVITE_TTL_HOURS: z.coerce.number().default(48),
});

export type Platform_Config = z.infer<typeof Platform_Env_Schema>;
export const PLATFORM_CONFIG = Symbol('PLATFORM_CONFIG');

export function loadPlatformConfig(): Platform_Config {
  const parsed = Platform_Env_Schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid platform configuration in Backend/.env:\n${issues}`);
  }
  const config = parsed.data;
  if (config.NODE_ENV === 'production' && !config.PLATFORM_ALLOWED_IPS && config.PLATFORM_ALLOW_ANY_IP !== 'true') {
    throw new Error('Production admin API needs PLATFORM_ALLOWED_IPS (office / VPN IPs) or PLATFORM_ALLOW_ANY_IP=true behind a VPN');
  }
  return config;
}

export const PLATFORM_ISSUER = 'car-services-platform';
export const PLATFORM_AUDIENCE = 'platform';
export const STAFF_PASSWORD_MIN = 12;
