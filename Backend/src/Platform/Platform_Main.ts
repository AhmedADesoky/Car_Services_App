import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Platform_App_Module } from './Platform_App_Module';
import { configurePlatformApp } from './Platform_Setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(Platform_App_Module);
  configurePlatformApp(app);
  app.enableShutdownHooks();
  const port = Number(process.env.PLATFORM_PORT ?? 3001);
  // Bind to localhost by default: only the Admin website's server (same machine / private network) calls it.
  await app.listen(port, process.env.PLATFORM_HOST ?? '127.0.0.1');
  Logger.log(`Admin Console API on http://127.0.0.1:${port}/platform/v1`, 'Platform_Main');
}

void bootstrap();
