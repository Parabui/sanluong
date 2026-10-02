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

  @Get('xuong')
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
