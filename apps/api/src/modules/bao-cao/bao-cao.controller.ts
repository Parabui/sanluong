import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { LOAI_BAO_CAO, type LoaiBaoCao, type PhamVi, zLocBaoCao } from '@vsn/shared';
import type { Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import type { VsnClsStore } from '../../core/ngu-canh.js';
import { Quyen } from '../../core/quyen/quyen.decorator.js';
import { ghiExcel } from './bao-cao.excel.js';
import { BaoCaoService, type Loc } from './bao-cao.service.js';

class LocBaoCaoDto extends createZodDto(zLocBaoCao) {}
const Loai = () => Param('loai', new ZodValidationPipe(z.enum(LOAI_BAO_CAO)));

/** Báo cáo sản lượng · F5 — Superadmin, QL xưởng (xưởng gắn), Tổ trưởng (R3), IE, IT/HR [F8] */
@Controller('bao-cao')
@Quyen('BAO_CAO_XEM')
export class BaoCaoController {
  constructor(
    private readonly baoCao: BaoCaoService,
    private readonly cls: ClsService<VsnClsStore>,
  ) {}

  private get phamVi(): PhamVi {
    return this.cls.get('phamVi')!;
  }

  /** Không truyền tu/den → hôm nay (server tính) [D5] */
  private khoang(q: LocBaoCaoDto): Loc {
    const homNay = this.baoCao.homNay();
    const tu = q.tu ?? q.den ?? homNay;
    return { ...q, tu, den: q.den ?? (q.tu ? q.tu : homNay) };
  }

  @Get(':loai')
  async xem(@Loai() loai: LoaiBaoCao, @Query() q: LocBaoCaoDto) {
    const loc = this.khoang(q);
    const kq = await this.baoCao.chay(loai, this.phamVi, loc, { trang: q.trang, kichThuoc: q.kichThuoc });
    return { loai, tu: loc.tu, den: loc.den, homNay: this.baoCao.homNay(), trang: q.trang, kichThuoc: q.kichThuoc, ...kq };
  }

  /** Stream .xlsx — cùng hàm truy vấn với màn hình, lấy toàn bộ dòng; không có dữ liệu → không xuất file rỗng */
  @Get(':loai/xuat')
  async xuat(@Loai() loai: LoaiBaoCao, @Query() q: LocBaoCaoDto, @Res() res: Response): Promise<void> {
    const loc = this.khoang(q);
    const kq = await this.baoCao.chay(loai, this.phamVi, loc, null);
    if (!kq.dong.length) throw new LoiNghiepVu('KHONG_CO_DU_LIEU', { message: 'Không có dữ liệu để xuất.' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bao-cao-${loai}-${loc.tu}-${loc.den}.xlsx"`);
    await ghiExcel(loai, kq, loc, res);
    res.end();
  }
}
