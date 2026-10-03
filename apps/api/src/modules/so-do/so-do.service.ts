import { Injectable } from '@nestjs/common';
import {
  type CongDoanSoDo,
  type DeXuatSaoChep,
  type KetThucMaHang,
  type LuuSoDo,
  type NgayLamViec,
  type PhamVi,
  type SaoChepSoDo,
  type SoDo,
} from '@vsn/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { khoangNgay } from '../../core/prisma/ngay-db.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';
import { PhamViService } from '../../core/quyen/pham-vi.service.js';
import { MaHangService } from '../ma-hang/ma-hang.service.js';

type Db = PrismaService | Tx;

const CHON_CD = {
  id: true, ma: true, ten: true, laCongDoanHoanThanh: true, trangThai: true, maHangId: true,
  maHang: { select: { ma: true } },
} as const;
type CdDb = { id: string; ma: string; ten: string; laCongDoanHoanThanh: boolean; trangThai: string; maHangId: string; maHang: { ma: string } };

/**
 * Sơ đồ chuyền — gán công đoạn vào trạm · F4 [R 3.6] [TDD 8.7].
 * Mỗi lần Lưu / Kết thúc mã hàng: đóng dòng bị gỡ (hieuLucDen = lúc lưu), thêm dòng mới (hieuLucTu = lúc lưu); KHÔNG xóa dòng.
 * Sơ đồ của ngày D = mọi dòng có khoảng hiệu lực giao với ngày D → công đoạn gỡ giữa ngày vẫn nhập được số cuối ngày.
 */
@Injectable()
export class SoDoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly phamVi: PhamViService,
    private readonly clock: ClockService,
    private readonly maHang: MaHangService,
  ) {}

  /**
   * Công đoạn thuộc sơ đồ ngày D của các trạm [R 3.6] — dùng chung cho F4 (xem ngày cũ), F1 (form công nhân), F10, F13.
   */
  async soDoNgay(db: Db, tramIds: string[], ngay: NgayLamViec): Promise<Map<string, string[]>> {
    const { tu, den } = khoangNgay(ngay);
    const ds = await db.ganCongDoan.findMany({
      where: { tramId: { in: tramIds }, hieuLucTu: { lt: den }, OR: [{ hieuLucDen: null }, { hieuLucDen: { gt: tu } }] },
      select: { tramId: true, congDoanId: true },
    });
    const kq = new Map<string, string[]>();
    for (const g of ds) {
      const cu = kq.get(g.tramId) ?? [];
      if (!cu.includes(g.congDoanId)) kq.set(g.tramId, [...cu, g.congDoanId]);
    }
    return kq;
  }

  private async tramApp(db: Db, chuyenId: string) {
    return db.tram.findMany({
      where: { chuyenId, nhapQuaApp: true, trangThai: 'HOAT_DONG' },
      orderBy: { soTram: 'asc' },
      select: { id: true, soTram: true },
    });
  }

  private sangCd(c: CdDb, smv: Map<string, number>): CongDoanSoDo {
    return {
      congDoanId: c.id, ma: c.ma, ten: c.ten, smv: smv.get(c.id) ?? null, laCongDoanHoanThanh: c.laCongDoanHoanThanh,
      maHangId: c.maHangId, maMaHang: c.maHang.ma, hoatDong: c.trangThai === 'HOAT_DONG',
    };
  }

  async xem(pv: PhamVi, chuyenId: string, ngayHoi?: NgayLamViec): Promise<SoDo> {
    const chuyen = await this.prisma.chuyen.findUnique({ where: { id: chuyenId } });
    if (!chuyen) throw new LoiNghiepVu('KHONG_TIM_THAY');
    await this.phamVi.kiemTraChuyen(pv, chuyenId);
    const homNay = this.clock.homNay();
    const ngay = ngayHoi ?? homNay;
    const hienHanh = ngay === homNay;

    const tram = await this.tramApp(this.prisma, chuyenId);
    const gan = hienHanh
      ? (await this.prisma.ganCongDoan.findMany({ where: { tramId: { in: tram.map((t) => t.id) }, hieuLucDen: null }, select: { tramId: true, congDoanId: true } }))
          .reduce((m, g) => m.set(g.tramId, [...(m.get(g.tramId) ?? []), g.congDoanId]), new Map<string, string[]>())
      : await this.soDoNgay(this.prisma, tram.map((t) => t.id), ngay);

    const chay = await this.prisma.chuyenMaHang.findMany({
      where: { chuyenId, ketThuc: null },
      orderBy: { batDau: 'asc' },
      select: { batDau: true, maHang: { select: { id: true, ma: true, ten: true } } },
    });
    const daGan = new Set([...gan.values()].flat());
    const cdChay = await this.prisma.congDoan.findMany({
      where: { maHangId: { in: chay.map((c) => c.maHang.id) }, trangThai: 'HOAT_DONG' },
      orderBy: [{ maHangId: 'asc' }, { ma: 'asc' }],
      select: CHON_CD,
    });
    const cdGan = await this.prisma.congDoan.findMany({ where: { id: { in: [...daGan] } }, select: CHON_CD });
    const tatCa = new Map([...cdChay, ...cdGan].map((c) => [c.id, c]));
    const smv = await this.maHang.smvTaiNgay(this.prisma, [...tatCa.keys()], ngay);

    const phienBan = await this.prisma.auditLog.findFirst({
      where: { doiTuong: 'chuyen', doiTuongId: chuyenId, hanhDong: { in: ['LUU_SO_DO', 'KET_THUC_MA_HANG'] } },
      orderBy: { luc: 'desc' },
      select: { luc: true, nguoiThucHienId: true },
    });
    const nguoi = phienBan?.nguoiThucHienId
      ? (await this.prisma.taiKhoan.findUnique({ where: { id: phienBan.nguoiThucHienId }, select: { hoTen: true } }))?.hoTen ?? null
      : null;

    return {
      chuyenId, maChuyen: chuyen.ma, tenChuyen: chuyen.ten, versionSoDo: chuyen.versionSoDo, ngay, hienHanh,
      maHangDangChay: chay.map((c) => ({ id: c.maHang.id, ma: c.maHang.ma, ten: c.maHang.ten, batDau: c.batDau.toISOString() })),
      tram: tram.map((t) => ({
        id: t.id,
        soTram: t.soTram,
        congDoan: (gan.get(t.id) ?? []).map((id) => tatCa.get(id)!).filter(Boolean)
          .sort((a, b) => a.maHang.ma.localeCompare(b.maHang.ma) || a.ma.localeCompare(b.ma))
          .map((c) => this.sangCd(c, smv)),
      })),
      chuaGan: cdChay.filter((c) => !daGan.has(c.id)).map((c) => this.sangCd(c, smv)),
      phienBan: phienBan ? { luc: phienBan.luc.toISOString(), nguoi } : null,
    };
  }

  /** Khóa dòng chuyền + kiểm tra phạm vi và version sơ đồ (người lưu sau nhận cảnh báo, phải tải lại) [F4] */
  private async khoaChuyen(tx: Tx, pv: PhamVi, chuyenId: string, versionSoDo: number) {
    await tx.$queryRaw`SELECT 1 FROM chuyen WHERE id = ${chuyenId}::uuid FOR UPDATE`;
    const c = await tx.chuyen.findUnique({ where: { id: chuyenId } });
    if (!c) throw new LoiNghiepVu('KHONG_TIM_THAY');
    await this.phamVi.kiemTraChuyen(pv, chuyenId);
    if (c.versionSoDo !== versionSoDo) {
      const loi = await this.audit.loiDaThayDoi(tx, 'chuyen', chuyenId);
      throw new LoiNghiepVu('DU_LIEU_DA_THAY_DOI', { message: loi.message.replace('Dữ liệu', 'Sơ đồ') });
    }
    return c;
  }

  async luu(pv: PhamVi, dto: LuuSoDo): Promise<{ them: number; go: number; versionSoDo: number }> {
    return this.audit.giaoDich(async (tx) => {
      await this.khoaChuyen(tx, pv, dto.chuyenId, dto.versionSoDo);
      const tram = new Set((await this.tramApp(tx, dto.chuyenId)).map((t) => t.id));
      for (const g of dto.gan) if (!tram.has(g.tramId)) throw new LoiNghiepVu('TRAM_KHONG_HOP_LE');

      const hienTai = await tx.ganCongDoan.findMany({
        where: { tramId: { in: dto.gan.map((g) => g.tramId) }, hieuLucDen: null },
        select: { id: true, tramId: true, congDoanId: true },
      });
      const khoa = (tramId: string, cdId: string) => `${tramId}|${cdId}`;
      const muon = new Set(dto.gan.flatMap((g) => g.congDoanIds.map((c) => khoa(g.tramId, c))));
      const co = new Set(hienTai.map((g) => khoa(g.tramId, g.congDoanId)));
      const go = hienTai.filter((g) => !muon.has(khoa(g.tramId, g.congDoanId)));
      const them = [...muon].filter((k) => !co.has(k)).map((k) => { const [tramId, congDoanId] = k.split('|') as [string, string]; return { tramId, congDoanId }; });

      // Công đoạn thêm mới: phải tồn tại, đang hoạt động; mã hàng chưa chạy trên chuyền → bắt đầu chạy (tối đa 2 — trigger DB)
      const cdThem = await tx.congDoan.findMany({ where: { id: { in: [...new Set(them.map((t) => t.congDoanId))] } }, select: { id: true, trangThai: true, maHangId: true } });
      if (cdThem.length !== new Set(them.map((t) => t.congDoanId)).size || cdThem.some((c) => c.trangThai !== 'HOAT_DONG')) {
        throw new LoiNghiepVu('CONG_DOAN_KHONG_HOP_LE');
      }
      const now = this.clock.now();
      const dangChay = new Set((await tx.chuyenMaHang.findMany({ where: { chuyenId: dto.chuyenId, ketThuc: null }, select: { maHangId: true } })).map((c) => c.maHangId));
      for (const maHangId of new Set(cdThem.map((c) => c.maHangId))) {
        if (!dangChay.has(maHangId)) {
          await tx.chuyenMaHang.create({ data: { chuyenId: dto.chuyenId, maHangId, batDau: now } }); // > 2 mã → QUA_2_MA_HANG
          dangChay.add(maHangId);
        }
      }

      if (go.length) await tx.ganCongDoan.updateMany({ where: { id: { in: go.map((g) => g.id) } }, data: { hieuLucDen: now } });
      if (them.length) await tx.ganCongDoan.createMany({ data: them.map((t) => ({ ...t, hieuLucTu: now })) });
      const c = await tx.chuyen.update({ where: { id: dto.chuyenId }, data: { versionSoDo: { increment: 1 } }, select: { versionSoDo: true } });
      await this.audit.ghi(tx, { hanhDong: 'LUU_SO_DO', doiTuong: 'chuyen', doiTuongId: dto.chuyenId, moi: { them, go: go.map((g) => ({ tramId: g.tramId, congDoanId: g.congDoanId })) } });
      return { them: them.length, go: go.length, versionSoDo: c.versionSoDo };
    });
  }

  /** Kết thúc mã hàng trên chuyền: gỡ toàn bộ công đoạn của mã đó khỏi trạm, đặt ChuyenMaHang.ketThuc [F4] */
  async ketThucMaHang(pv: PhamVi, dto: KetThucMaHang): Promise<{ go: number; versionSoDo: number }> {
    return this.audit.giaoDich(async (tx) => {
      await this.khoaChuyen(tx, pv, dto.chuyenId, dto.versionSoDo);
      const now = this.clock.now();
      const { count: ketThuc } = await tx.chuyenMaHang.updateMany({ where: { chuyenId: dto.chuyenId, maHangId: dto.maHangId, ketThuc: null }, data: { ketThuc: now } });
      if (!ketThuc) throw new LoiNghiepVu('KHONG_TIM_THAY', { message: 'Mã hàng không chạy trên chuyền này.' });
      const { count: go } = await tx.ganCongDoan.updateMany({
        where: { hieuLucDen: null, tram: { chuyenId: dto.chuyenId }, congDoan: { maHangId: dto.maHangId } },
        data: { hieuLucDen: now },
      });
      const c = await tx.chuyen.update({ where: { id: dto.chuyenId }, data: { versionSoDo: { increment: 1 } }, select: { versionSoDo: true } });
      await this.audit.ghi(tx, { hanhDong: 'KET_THUC_MA_HANG', doiTuong: 'chuyen', doiTuongId: dto.chuyenId, moi: { maHangId: dto.maHangId, go } });
      return { go, versionSoDo: c.versionSoDo };
    });
  }

  /**
   * Sao chép sơ đồ cùng mã hàng từ chuyền khác: giữ bố cục (theo số trạm) + công đoạn, bỏ qua công đoạn đã ngưng [F4].
   * Chỉ trả ĐỀ XUẤT — người dùng xem rồi bấm Lưu (PUT /api/so-do).
   */
  async saoChep(pv: PhamVi, dto: SaoChepSoDo): Promise<DeXuatSaoChep> {
    await this.phamVi.kiemTraChuyen(pv, dto.chuyenDichId);
    await this.phamVi.kiemTraChuyen(pv, dto.chuyenNguonId);
    const [nguon, dich] = await Promise.all([this.tramApp(this.prisma, dto.chuyenNguonId), this.tramApp(this.prisma, dto.chuyenDichId)]);
    if (!dich.length) throw new LoiNghiepVu('KHONG_TIM_THAY');
    const gan = await this.prisma.ganCongDoan.findMany({
      where: { tramId: { in: nguon.map((t) => t.id) }, hieuLucDen: null, congDoan: { maHangId: dto.maHangId } },
      select: { tramId: true, congDoan: { select: CHON_CD } },
    });
    const soTramNguon = new Map(nguon.map((t) => [t.id, t.soTram]));
    const soTramDich = new Set(dich.map((t) => t.soTram));
    const smv = await this.maHang.smvTaiNgay(this.prisma, gan.map((g) => g.congDoan.id), this.clock.homNay());
    const theoTram = new Map<number, CongDoanSoDo[]>();
    let boQuaNgung = 0;
    let boQuaTram = 0;
    for (const g of gan) {
      const so = soTramNguon.get(g.tramId)!;
      if (g.congDoan.trangThai !== 'HOAT_DONG') { boQuaNgung++; continue; }
      if (!soTramDich.has(so)) { boQuaTram++; continue; }
      theoTram.set(so, [...(theoTram.get(so) ?? []), this.sangCd(g.congDoan, smv)]);
    }
    return { gan: [...theoTram].sort((a, b) => a[0] - b[0]).map(([soTram, congDoan]) => ({ soTram, congDoan })), boQuaNgung, boQuaTram };
  }
}
