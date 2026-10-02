import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { ganTraceId } from './core/trace-id.js';

/** Cấu hình HTTP dùng chung cho main.ts và test (để test chạy đúng như production) */
export function cauHinhApp(app: NestExpressApplication): NestExpressApplication {
  app.use(ganTraceId); // phải đứng đầu
  app.disable('x-powered-by');
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  // Không bật CORS: worker, web, api cùng một domain [TDD 9.3]
  return app;
}
