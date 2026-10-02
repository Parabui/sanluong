import { Body, Controller, Get, HttpCode, Post, Put, Query } from '@nestjs/common';
import {
  type DeXuatSaoChep,
  type PhamVi,
  type SoDo,
  zKetThucMaHang,
  zLocSoDo,
  zLuuSoDo,
  zSaoChepSoDo,
} from '@vsn/shared';
import { ClsService } from 'nestjs-cls';
import { createZodDto } from 'nestjs-zod';
import type { VsnClsStore } from '../../core/ngu-canh.js';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { SoDoService } from './so-do.service.js';

class LocSoDoDto extends createZodDto(zLocSoDo) {}
class LuuSoDoDto extends createZodDto(zLuuSoDo) {}
class KetThucMaHangDto extends createZodDto(zKetThucMaHang) {}
class SaoChepSoDoDto extends createZodDto(zSaoChepSoDo) {}

/** Sơ đồ chuyền · F4 — Superadmin, IE (mọi chuyền), Tổ trưởng (chuyền được gắn) */
@Controller('so-do')
@Quyen('SO_DO_GAN')
export class SoDoController {
  constructor(
    private readonly soDo: SoDoService,
    private readonly cls: ClsService<VsnClsStore>,
  ) {}

  private get phamVi(): PhamVi {
    return this.cls.get('phamVi')!;
  }

  @Get()
  xem(@Query() loc: LocSoDoDto): Promise<SoDo> {
    return this.soDo.xem(this.phamVi, loc.chuyenId, loc.ngay);
  }

  @Put()
  luu(@Body() dto: LuuSoDoDto): Promise<{ them: number; go: number; versionSoDo: number }> {
    return this.soDo.luu(this.phamVi, dto);
  }

  @Post('ket-thuc-ma-hang')
  @HttpCode(200)
  ketThuc(@Body() dto: KetThucMaHangDto): Promise<{ go: number; versionSoDo: number }> {
    return this.soDo.ketThucMaHang(this.phamVi, dto);
  }

  @Post('sao-chep')
  @HttpCode(200)
  saoChep(@Body() dto: SaoChepSoDoDto): Promise<DeXuatSaoChep> {
    return this.soDo.saoChep(this.phamVi, dto);
  }
}
