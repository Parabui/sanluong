import { Injectable } from '@nestjs/common';
import type { FormNhap, NgayLamViec } from '@vsn/shared';
import { ClockService } from '../../core/clock/clock.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { ngayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { MaHangService } from '../ma-hang/ma-hang.service.js';
import { CuaSoNhapService } from '../san-luong/cua-so-nhap.service.js';
import { GhiSanLuongService } from '../san-luong/ghi-san-luong.service.js';
import { SoDoService } from '../so-do/so-do.service.js';

/**
 * Form nhập của công nhân · F1: công đoạn theo SƠ ĐỒ CỦA NGÀY ĐANG CHỌN (kể cả công đoạn đã gỡ trong ngày) [R 3.6],
 * số đã lưu, trạng thái từng ô (Ô đã điều chỉnh → chỉ đọc) [R 5.4], giờ làm để app tính trần lý thuyết [R 3.3].
 */
@Injectable()
export class FormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly cuaSo: CuaSoNhapService,
    private readonly soDo: SoDoService,
    private readonly maHang: MaHangService,
    private readonly ghi: GhiSanLuongService,
  ) {}

  async form(thietBiId: string, tramId: string, ngay: NgayLamViec): Promise<FormNhap> {
    const tram = await this.prisma.tram.findUnique({ where: { id: tramId }, include: { chuyen: true } });
    if (!tram) throw new LoiNghiepVu('KHONG_TIM_THAY');
    if (!(await this.cuaSo.ngayMoNhap(this.prisma, tram.chuyenId)).includes(ngay)) {
      if ((await this.cuaSo.ungVien()).includes(ngay)) throw new LoiNghiepVu('NGAY_DA_CHOT', { message: 'Ngày đã chốt, liên hệ tổ trưởng.' });
      throw new LoiNghiepVu('NGAY_KHONG_MO_NHAP');
    }
    const phien = await this.prisma.phienTram.findFirst({ where: { tramId, ngayLamViec: ngayDb(ngay), thietBiId, dangXuatLuc: null } });
    if (!phien) throw await this.ghi.loiPhienKhongCon(this.prisma, tramId, tram.soTram, ngay, thietBiId);
    const nhanVienId = phien.nhanVienId;

    const ids = (await this.soDo.soDoNgay(this.prisma, [tramId], ngay)).get(tramId) ?? [];
    const [cd, sl, dangGan, smv, gio] = await Promise.all([
      this.prisma.congDoan.findMany({ where: { id: { in: ids } }, select: { id: true, ma: true, ten: true, maHang: { select: { ma: true } } } }),
      this.prisma.sanLuong.findMany({
        where: { ngayLamViec: ngayDb(ngay), tramId, nhanVienId, congDoanId: { in: ids } },
        include: { lichSu: { where: { nguon: { in: ['SUA_WEB', 'NHAP_HO'] } }, orderBy: { lucServer: 'desc' }, take: 1 } },
      }),
      this.prisma.ganCongDoan.findMany({ where: { tramId, hieuLucDen: null }, select: { congDoanId: true } }),
      this.maHang.smvTaiNgay(this.prisma, ids, ngay),
      this.prisma.$queryRaw<{ gio: string | null }[]>`SELECT gio_lam_hieu_luc(${nhanVienId}::uuid, ${ngayDb(ngay)})::text AS gio`,
    ]);
    const theoCd = new Map(sl.map((s) => [s.congDoanId, s]));
    const nguoi = new Map(
      (await this.prisma.taiKhoan.findMany({ where: { id: { in: sl.flatMap((s) => s.lichSu.map((l) => l.nguoiThucHienId)) } }, select: { id: true, hoTen: true } }))
        .map((t) => [t.id, t.hoTen]),
    );
    const conGan = new Set(dangGan.map((g) => g.congDoanId));

    return {
      tramId, soTram: tram.soTram, maChuyen: tram.chuyen.ma, ngay, laHomNay: ngay === this.clock.homNay(),
      gioLam: gio[0]?.gio != null ? Number(gio[0].gio) : null,
      congDoan: cd
        .sort((a, b) => a.maHang.ma.localeCompare(b.maHang.ma) || a.ma.localeCompare(b.ma))
        .map((c) => {
          const s = theoCd.get(c.id);
          const ls = s?.lichSu[0];
          return {
            congDoanId: c.id, ma: c.ma, ten: c.ten, maMaHang: c.maHang.ma, smv: smv.get(c.id) ?? null,
            soLuong: s?.soLuong ?? null,
            capNhatLuc: s?.capNhatLucServer.toISOString() ?? null,
            trangThai: !s ? 'CHUA_NHAP' : s.daDieuChinh ? 'DA_DIEU_CHINH' : 'DA_LUU',
            dieuChinh: s?.daDieuChinh && ls
              ? { soCu: ls.soCu, lyDo: ls.lyDo, boi: nguoi.get(ls.nguoiThucHienId) ?? null, luc: ls.lucServer.toISOString() }
              : null,
            daGo: !conGan.has(c.id),
          };
        }),
    };
  }
}
