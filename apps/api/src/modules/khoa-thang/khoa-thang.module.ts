import { Module } from '@nestjs/common';
import { KhoaThangController } from './khoa-thang.controller.js';
import { KhoaThangService } from './khoa-thang.service.js';

@Module({ controllers: [KhoaThangController], providers: [KhoaThangService] })
export class KhoaThangModule {}
