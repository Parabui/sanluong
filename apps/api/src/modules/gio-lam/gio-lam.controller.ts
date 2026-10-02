import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  type DsYeuCauGio,
  type GioMacDinhXuong,
  type NvGioLam,
  type PhamVi,
  zDuyetYeuCauGio,
  zLocNvGioLam,
  zLocYeuCauGio,
  zLuuGioMacDinh,
  zSuaGioTrucTiep,
  zTuChoiYeuCauGio,
  zUuid,
} from '@vsn/shared';
import { ClsService } from 'nestjs-cls';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import type { VsnClsStore } from '../../core/ngu-canh.js';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { GioLamService } from './gio-lam.service.js';
import { GioMacDinhService } from './gio-mac-dinh.service.js';

class LocYeuCauGioDto extends createZodDto(zLocYeuCauGio) {}
class LocNvGioLamDto extends createZodDto(zLocNvGioLam) {}
class DuyetDto extends createZodDto(zDuyetYeuCauGio) {}
class TuChoiDto extends createZodDto(zTuChoiYeuCauGio) {}
class SuaTrucTiepDto extends createZodDto(zSuaGioTrucTiep) {}
class LuuGioMacDinhDto extends createZodDto(zLuuGioMacDinh) {}

const Id = () => Param('id', new ZodValidationPipe(zUuid));

abstract class CoPhamVi {
  constructor(protected readonly cls: ClsService<VsnClsStore>) {}
  protected get phamVi(): PhamVi {
    return this.cls.get('phamVi')!;
  }
}

/** Duyệt / sửa giờ làm · F6 — Superadmin, Tổ trưởng (NV có chuyền gốc NGÀY ĐÓ thuộc chuyền gắn) [R 5.8] [D18] */
@Controller('gio-lam')
@Quyen('GIO_LAM_DUYET')
export class GioLamController extends CoPhamVi {
  constructor(
    private readonly gioLam: GioLamService,
    cls: ClsService<VsnClsStore>,
  ) {
    super(cls);
  }

  @Get('cho-duyet')
  dsYeuCau(@Query() loc: LocYeuCauGioDto): Promise<DsYeuCauGio> {
    return this.gioLam.dsYeuCau(this.phamVi, loc);
  }

  @Get('nhan-vien')
  dsNhanVien(@Query() loc: LocNvGioLamDto): Promise<NvGioLam[]> {
    return this.gioLam.dsNhanVien(this.phamVi, loc.chuyenId, loc.ngay);
  }

  @Post(':id/duyet')
  @HttpCode(200)
  duyet(@Id() id: string, @Body() dto: DuyetDto) {
    return this.gioLam.duyet(this.phamVi, id, dto.version);
  }

  @Post(':id/tu-choi')
  @HttpCode(204)
  tuChoi(@Id() id: string, @Body() dto: TuChoiDto): Promise<void> {
    return this.gioLam.tuChoi(this.phamVi, id, dto.version, dto.lyDo);
  }

  @Put('truc-tiep')
  suaTrucTiep(@Body() dto: SuaTrucTiepDto) {
    return this.gioLam.suaTrucTiep(this.phamVi, dto);
  }
}

/** Giờ mặc định theo xưởng × thứ · F6 — Superadmin, Quản lý xưởng (xưởng được gắn) */
@Controller('gio-mac-dinh')
@Quyen('GIO_MAC_DINH_CAI')
export class GioMacDinhController extends CoPhamVi {
  constructor(
    private readonly macDinh: GioMacDinhService,
    cls: ClsService<VsnClsStore>,
  ) {
    super(cls);
  }

  @Get()
  ds(): Promise<GioMacDinhXuong[]> {
    return this.macDinh.ds(this.phamVi);
  }

  @Put()
  luu(@Body() dto: LuuGioMacDinhDto): Promise<GioMacDinhXuong> {
    return this.macDinh.luu(this.phamVi, dto);
  }
}
