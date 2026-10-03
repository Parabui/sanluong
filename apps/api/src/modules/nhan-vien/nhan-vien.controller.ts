import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type NhanVien,
  type PhamVi,
  zLocNhanVien,
  zSuaNhanVien,
  zTaoNhanVien,
  zUuid,
} from '@vsn/shared';
import { ClsService } from 'nestjs-cls';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import type { VsnClsStore } from '../../core/ngu-canh.js';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { NhanVienService } from './nhan-vien.service.js';

class LocNhanVienDto extends createZodDto(zLocNhanVien) {}
class TaoNhanVienDto extends createZodDto(zTaoNhanVien) {}
class SuaNhanVienDto extends createZodDto(zSuaNhanVien) {}

const Id = () => Param('id', new ZodValidationPipe(zUuid));

/** Nhân viên · F2 — Superadmin, IT/HR (ma trận F8) */
@Controller('nhan-vien')
@Quyen('NHAN_VIEN_QUAN_LY')
export class NhanVienController {
  constructor(
    private readonly nhanVien: NhanVienService,
    private readonly cls: ClsService<VsnClsStore>,
  ) {}

  private get phamVi(): PhamVi {
    return this.cls.get('phamVi')!;
  }

  @Get()
  ds(@Query() loc: LocNhanVienDto): Promise<{ duLieu: NhanVien[]; tong: number; trang: number; kichThuoc: number }> {
    return this.nhanVien.ds(this.phamVi, loc);
  }

  @Post()
  tao(@Body() dto: TaoNhanVienDto): Promise<NhanVien> {
    return this.nhanVien.tao(dto);
  }

  @Patch(':id')
  sua(@Id() id: string, @Body() dto: SuaNhanVienDto): Promise<NhanVien> {
    return this.nhanVien.sua(id, dto);
  }

  /** Xóa hẳn: chỉ Superadmin (kiểm ở service), chỉ NV chưa có sản lượng [R 5.6] */
  @Delete(':id')
  @HttpCode(204)
  xoa(@Id() id: string): Promise<void> {
    return this.nhanVien.xoa(id, this.cls.get('taiKhoan')!);
  }
}
