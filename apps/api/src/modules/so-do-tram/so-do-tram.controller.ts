import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { type PhamVi, type SoDoTram, zDangXuatHo, zLocSoDoTram } from '@vsn/shared';
import { ClsService } from 'nestjs-cls';
import { createZodDto } from 'nestjs-zod';
import type { VsnClsStore } from '../../core/ngu-canh.js';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { SoDoTramService } from './so-do-tram.service.js';

class LocDto extends createZodDto(zLocSoDoTram) {}
class DangXuatHoDto extends createZodDto(zDangXuatHo) {}

/** Sơ đồ trạm trực tiếp · F17 — Superadmin, Tổ trưởng (chuyền gắn) [D26] */
@Controller('so-do-tram')
@Quyen('SO_DO_TRAM_XEM')
export class SoDoTramController {
  constructor(
    private readonly soDoTram: SoDoTramService,
    private readonly cls: ClsService<VsnClsStore>,
  ) {}

  private get phamVi(): PhamVi {
    return this.cls.get('phamVi')!;
  }

  @Get()
  xem(@Query() loc: LocDto): Promise<SoDoTram> {
    return this.soDoTram.xem(this.phamVi, loc.chuyenId, loc.phienBan);
  }

  @Post('dang-xuat-ho')
  @HttpCode(204)
  dangXuatHo(@Body() dto: DangXuatHoDto): Promise<void> {
    return this.soDoTram.dangXuatHo(this.phamVi, dto);
  }
}
