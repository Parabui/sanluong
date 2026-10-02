import { Module } from '@nestjs/common';
import { MaHangModule } from '../ma-hang/ma-hang.module.js';
import { CuaSoNhapService } from './cua-so-nhap.service.js';
import { GhiSanLuongService } from './ghi-san-luong.service.js';

/** Ghi sản lượng — mọi nguồn (app, sửa Web, nhập hộ) đi qua GhiSanLuongService [CLAUDE.md #4] */
@Module({ imports: [MaHangModule], providers: [GhiSanLuongService, CuaSoNhapService], exports: [GhiSanLuongService, CuaSoNhapService] })
export class SanLuongModule {}
