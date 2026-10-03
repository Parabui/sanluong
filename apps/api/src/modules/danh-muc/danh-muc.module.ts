import { Module } from '@nestjs/common';
import { DanhMucController } from './danh-muc.controller.js';
import { DanhMucService } from './danh-muc.service.js';

@Module({ controllers: [DanhMucController], providers: [DanhMucService], exports: [DanhMucService] })
export class DanhMucModule {}
