import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { App_Module } from './App_Module';
import { Problem_Json_Filter } from './Common/Errors/Problem_Json_Filter';
import { configureApp } from './Main_Setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(App_Module, { bodyParser: true });
  configureApp(app);
  app.useGlobalFilters(new Problem_Json_Filter());
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  // 0.0.0.0 so the Android emulator (10.0.2.2) and phones on the same Wi-Fi can reach it
  await app.listen(port, '0.0.0.0');
  Logger.log(`Car Services API on http://localhost:${port}/v1`, 'Main');
}

void bootstrap();
