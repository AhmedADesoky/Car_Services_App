import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { Problem_Json_Filter } from '../Common/Errors/Problem_Json_Filter';
import { ipAllowlist } from './Common/Ip_Allowlist';
import { platformContextMiddleware } from './Common/Platform_Context';

/** Shared by Platform_Main.ts and tests. The browser never calls this API: the Admin website's server does (no CORS). */
export function configurePlatformApp(app: INestApplication): void {
  const http = app.getHttpAdapter().getInstance();
  if (process.env.TRUST_PROXY) http.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  http.disable('x-powered-by');
  app.use(helmet());
  app.use(ipAllowlist(process.env.PLATFORM_ALLOWED_IPS ?? ''));
  app.use(platformContextMiddleware);
  app.setGlobalPrefix('platform/v1');
  app.useGlobalFilters(new Problem_Json_Filter());
}
