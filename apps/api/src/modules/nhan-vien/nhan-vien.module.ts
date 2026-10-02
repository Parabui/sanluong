import { Module } from '@nestjs/common';
import { NhanVienController } from './nhan-vien.controller.js';
import { NhanVienImport } from './nhan-vien-import.js';
import { NhanVienService } from './nhan-vien.service.js';

@Module({
  controllers: [NhanVienController],
  providers: [NhanVienService, NhanVienImport],
  exports: [NhanVienImport],
})
export class NhanVienModule {}
