import { Module } from '@nestjs/common';
import { MaHangController } from './ma-hang.controller.js';
import { MaHangService } from './ma-hang.service.js';

@Module({ controllers: [MaHangController], providers: [MaHangService], exports: [MaHangService] })
export class MaHangModule {}
