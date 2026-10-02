import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { cauHinhApp } from './cau-hinh-app.js';
import { docMoiTruong, napEnvDev } from './core/moi-truong.js';

napEnvDev();
const env = docMoiTruong();

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
cauHinhApp(app);
await app.listen(env.API_PORT);
app.get(Logger).log(`API ${env.APP_VERSION} chạy tại http://localhost:${env.API_PORT}/api`);
