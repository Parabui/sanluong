import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE, DiscoveryModule } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AuditService } from './audit/audit.service.js';
import { CauHinhService } from './cau-hinh/cau-hinh.service.js';
import { ClockService } from './clock/clock.service.js';
import { LoiFilter } from './loi/loi.filter.js';
import { docMoiTruong, MOI_TRUONG } from './moi-truong.js';
import { PhienWebService } from './phien/phien-web.service.js';
import { ThietBiService } from './phien/thiet-bi.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { ClientHeaderGuard } from './quyen/client-header.guard.js';
import { KiemTraRouteService } from './quyen/kiem-tra-route.service.js';
import { PhamViService } from './quyen/pham-vi.service.js';
import { QuyenGuard } from './quyen/quyen.guard.js';
import { QuyenService } from './quyen/quyen.service.js';

const DICH_VU = [
  ClockService,
  PrismaService,
  AuditService,
  CauHinhService,
  QuyenService,
  PhamViService,
  PhienWebService,
  ThietBiService,
  KiemTraRouteService,
];

/** Hạ tầng dùng chung cho mọi module nghiệp vụ */
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    { provide: MOI_TRUONG, useFactory: () => docMoiTruong() },
    ...DICH_VU,
    // Validation bằng schema Zod trong @vsn/shared [D3]
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    // Thứ tự guard: chống CSRF → phiên + quyền + phạm vi
    { provide: APP_GUARD, useClass: ClientHeaderGuard },
    { provide: APP_GUARD, useClass: QuyenGuard },
    { provide: APP_FILTER, useClass: LoiFilter },
  ],
  exports: [MOI_TRUONG, ...DICH_VU],
})
export class CoreModule {}
