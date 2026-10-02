import { Module } from '@nestjs/common';
import { MaHangModule } from '../ma-hang/ma-hang.module.js';
import { SoDoModule } from '../so-do/so-do.module.js';
import { BangSanLuongController, ChotNgayController } from './bang-san-luong.controller.js';
import { BangSanLuongService } from './bang-san-luong.service.js';
import { ChotNgayService } from './chot-ngay.service.js';
import { CuaSoNhapService } from './cua-so-nhap.service.js';
import { GhiSanLuongService } from './ghi-san-luong.service.js';

/**
 * Sản lượng — mọi nguồn (app, sửa Web, nhập hộ) đi qua GhiSanLuongService [CLAUDE.md #4];
 * Bảng sản lượng ngày + Chốt ngày · F10, F19.
 */
@Module({
  imports: [MaHangModule, SoDoModule],
  controllers: [BangSanLuongController, ChotNgayController],
  providers: [GhiSanLuongService, CuaSoNhapService, BangSanLuongService, ChotNgayService],
  exports: [GhiSanLuongService, CuaSoNhapService],
})
export class SanLuongModule {}
