import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service.js';
import { BaoTriService } from './bao-tri.service.js';
import { AuditLogController, CauHinhController } from './he-thong.controller.js';

/** Hệ thống: audit log, cài đặt, việc định kỳ (dọn dẹp, kiểm tra toàn vẹn) [TDD 12, 15.2] */
@Module({ controllers: [AuditLogController, CauHinhController], providers: [AuditLogService, BaoTriService], exports: [BaoTriService] })
export class HeThongModule {}
