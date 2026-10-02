import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  type Chuyen,
  type PhamVi,
  type Tram,
  type Xuong,
  zSuaChuyen,
  zSuaTram,
  zSuaXuong,
  zTaoChuyen,
  zTaoXuong,
  zUuid,
} from '@vsn/shared';
import { ClsService } from 'nestjs-cls';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import type { VsnClsStore } from '../../core/ngu-canh.js';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { DanhMucService } from './danh-muc.service.js';

class TaoXuongDto extends createZodDto(zTaoXuong) {}
class SuaXuongDto extends createZodDto(zSuaXuong) {}
class TaoChuyenDto extends createZodDto(zTaoChuyen) {}
class SuaChuyenDto extends createZodDto(zSuaChuyen) {}
class SuaTramDto extends createZodDto(zSuaTram) {}

/** Màn khác cần đọc danh sách xưởng / chuyền để chọn */
const DOC_DANH_MUC = ['DANH_MUC_XUONG_CHUYEN', 'NHAN_VIEN_QUAN_LY', 'TAI_KHOAN_QUAN_LY', 'SO_DO_GAN'] as const;

const Id = () => Param('id', new ZodValidationPipe(zUuid));

/** Danh mục Xưởng – Chuyền/Nhóm – Trạm · F9 — chỉ Superadmin (ma trận F8) */
@Controller()
@Quyen('DANH_MUC_XUONG_CHUYEN')
export class DanhMucController {
  constructor(
    private readonly danhMuc: DanhMucService,
    private readonly cls: ClsService<VsnClsStore>,
  ) {}

  private get phamVi(): PhamVi {
    return this.cls.get('phamVi')!;
  }

  /** Danh sách để chọn (dropdown) ở F2 Nhân viên, F8 Tài khoản, F4 Sơ đồ chuyền — đọc theo phạm vi */
  @Get('xuong')
  @Quyen(...DOC_DANH_MUC)
  dsXuong(): Promise<Xuong[]> {
    return this.danhMuc.dsXuong(this.phamVi);
  }

  @Post('xuong')
  taoXuong(@Body() dto: TaoXuongDto): Promise<Xuong> {
    return this.danhMuc.taoXuong(dto);
  }

  @Patch('xuong/:id')
  suaXuong(@Id() id: string, @Body() dto: SuaXuongDto): Promise<Xuong> {
    return this.danhMuc.suaXuong(id, dto);
  }

  @Get('chuyen')
  @Quyen(...DOC_DANH_MUC, 'GIO_LAM_DUYET') // Duyệt giờ: chọn chuyền gốc (lọc theo phạm vi)
  dsChuyen(@Query('xuongId', new ZodValidationPipe(zUuid.optional())) xuongId?: string): Promise<Chuyen[]> {
    return this.danhMuc.dsChuyen(this.phamVi, xuongId);
  }

  @Post('chuyen')
  taoChuyen(@Body() dto: TaoChuyenDto): Promise<Chuyen> {
    return this.danhMuc.taoChuyen(dto);
  }

  @Patch('chuyen/:id')
  suaChuyen(@Id() id: string, @Body() dto: SuaChuyenDto): Promise<Chuyen> {
    return this.danhMuc.suaChuyen(id, dto);
  }

  @Get('chuyen/:id/tram')
  dsTram(@Id() id: string): Promise<Tram[]> {
    return this.danhMuc.dsTram(this.phamVi, id);
  }

  @Patch('tram/:id')
  suaTram(@Id() id: string, @Body() dto: SuaTramDto): Promise<Tram> {
    return this.danhMuc.suaTram(id, dto);
  }
}
