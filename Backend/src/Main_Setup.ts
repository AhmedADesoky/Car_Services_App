import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { tenantStoreMiddleware } from './Common/Tenant_Context/Tenant_Store';

/** Shared by Main.ts and the tests so both run the exact same HTTP pipeline. */
export function configureApp(app: INestApplication): void {
  const http = app.getHttpAdapter().getInstance();
  // Behind a load balancer set TRUST_PROXY=1 so rate limits use the real client IP.
  if (process.env.TRUST_PROXY) http.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  http.disable('x-powered-by');
  app.use(helmet());
  app.use(tenantStoreMiddleware);
  // CORS only for the public website (request form, owner activation). Mobile apps send no Origin header.
  const origins = (process.env.PUBLIC_SITE_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length) app.enableCors({ origin: origins, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'], maxAge: 600 });
  app.setGlobalPrefix('v1');
}
