import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import type { IncomingMessage } from 'node:http';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { CoreModule } from './core/core.module.js';
import { docMoiTruong } from './core/moi-truong.js';
import { layTraceId } from './core/trace-id.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CongNhanModule } from './modules/cong-nhan/cong-nhan.module.js';
import { DanhMucModule } from './modules/danh-muc/danh-muc.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ImportModule } from './modules/import/import.module.js';
import { MaHangModule } from './modules/ma-hang/ma-hang.module.js';
import { NhanVienModule } from './modules/nhan-vien/nhan-vien.module.js';
import { SanLuongModule } from './modules/san-luong/san-luong.module.js';
import { SoDoModule } from './modules/so-do/so-do.module.js';
import { TaiKhoanModule } from './modules/tai-khoan/tai-khoan.module.js';

@Module({
  imports: [
    // Ngữ cảnh request (traceId, NguCanhAudit, PhamVi) qua AsyncLocalStorage
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true, idGenerator: (req: IncomingMessage) => layTraceId(req) },
    }),
    // Log JSON có traceId [D13]. KHÔNG log body / cookie (mật khẩu, họ tên) [TDD 18]
    LoggerModule.forRootAsync({
      useFactory: () => {
        const env = docMoiTruong();
        return {
          pinoHttp: {
            level: env.LOG_LEVEL,
            genReqId: (req: IncomingMessage) => layTraceId(req),
            customAttributeKeys: { reqId: 'traceId' },
            serializers: {
              req: (r: { id: string; method: string; url: string }) => ({ method: r.method, url: r.url }),
              res: (r: { statusCode: number }) => ({ status: r.statusCode }),
            },
            autoLogging: { ignore: (req: IncomingMessage) => req.url === '/api/health' },
            transport:
              env.NODE_ENV === 'development'
                ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' } }
                : undefined,
          },
        };
      },
    }),
    ScheduleModule.forRoot(),
    CoreModule,
    HealthModule,
    AuthModule,
    DanhMucModule,
    NhanVienModule,
    ImportModule,
    TaiKhoanModule,
    MaHangModule,
    SoDoModule,
    SanLuongModule,
    CongNhanModule,
  ],
})
export class AppModule {}
