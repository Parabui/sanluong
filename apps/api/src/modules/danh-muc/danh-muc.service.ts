import { Injectable } from '@nestjs/common';
import {
  type Chuyen,
  type PhamVi,
  type SuaChuyen,
  type SuaTram,
  type SuaXuong,
  type TaoChuyen,
  type TaoXuong,
  type Tram,
  TRAM_NHAP_QUA_APP_MVP,
  type Xuong,
  zSuaChuyen,
  zSuaTram,
  zSuaXuong,
} from '@vsn/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { laLoiTrung } from '../../core/loi/loi-db.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { ngayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';
import { PhamViService } from '../../core/quyen/pham-vi.service.js';

type CoVersion = { version: number };

/**
 * Danh mục Xưởng – Chuyền/Nhóm – Trạm · F9.
 * Mọi hàm đọc nhận PhamVi [CLAUDE.md #3]; mọi thao tác ghi đi qua audit.giaoDich + audit.ghi cùng transaction [#6].
 */
@Injectable()
export class DanhMucService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly phamVi: PhamViService,
    private readonly clock: ClockService,
  ) {}

  // ═══ Xưởng ═══

  async dsXuong(pv: PhamVi): Promise<Xuong[]> {
    const where =
      pv.loai === 'XUONG'
        ? { id: { in: pv.xuongIds } }
        : pv.loai === 'CHUYEN'
          ? { chuyen: { some: { id: { in: pv.chuyenIds } } } }
          : {};
    const ds = await this.prisma.xuong.findMany({
      where,
      orderBy: { ma: 'asc' },
      include: { _count: { select: { chuyen: true } } },
    });
    return ds.map((x) => ({ id: x.id, ma: x.ma, ten: x.ten, trangThai: x.trangThai, version: x.version, soChuyen: x._count.chuyen }));
  }

  async taoXuong(dto: TaoXuong): Promise<Xuong> {
    return this.audit.giaoDich(async (tx) => {
      const x = await this.batTrung(dto.ma, () => tx.xuong.create({ data: { ma: dto.ma, ten: dto.ten } }));
      await this.audit.ghi(tx, { hanhDong: 'TAO_XUONG', doiTuong: 'xuong', doiTuongId: x.id, moi: dto });
      return { id: x.id, ma: x.ma, ten: x.ten, trangThai: x.trangThai, version: x.version, soChuyen: 0 };
    });
  }

  async suaXuong(id: string, dauVao: SuaXuong): Promise<Xuong> {
    const dto = zSuaXuong.parse(dauVao);
    return this.audit.giaoDich(async (tx) => {
      // Khóa dòng xưởng: chặn tạo chuyền mới vào xưởng trong lúc đang ngưng (FK lấy FOR KEY SHARE)
      await tx.$queryRaw`SELECT 1 FROM xuong WHERE id = ${id}::uuid FOR UPDATE`;
      const cu = await this.timHoac404(tx.xuong.findUnique({ where: { id } }));
      await this.kiemTraVersion(tx, 'xuong', id, cu, dto.version);

      let goPhamVi: string[] = [];
      if (dto.trangThai === 'NGUNG' && cu.trangThai !== 'NGUNG') {
        const conChuyen = await tx.chuyen.findMany({ where: { xuongId: id, trangThai: 'HOAT_DONG' }, select: { ma: true } });
        if (conChuyen.length) {
          throw new LoiNghiepVu('CON_CHUYEN_HOAT_DONG', { chiTiet: { danhSach: conChuyen.map((c) => c.ma) } });
        }
        goPhamVi = await this.kiemTraGoPhamVi(tx, 'xuong', id, dto.xacNhan, 'quản lý xưởng', 'xưởng');
      }

      await this.batTrung(dto.ma, () =>
        tx.xuong.update({
          where: { id },
          data: { ma: dto.ma, ten: dto.ten, trangThai: dto.trangThai, version: { increment: 1 } },
        }),
      );
      if (goPhamVi.length) {
        await tx.taiKhoanXuong.deleteMany({ where: { xuongId: id } });
        await this.audit.ghi(tx, { hanhDong: 'DOI_PHAM_VI', doiTuong: 'xuong', doiTuongId: id, cu: { taiKhoanIds: goPhamVi }, lyDo: 'Ngưng xưởng' });
      }
      await this.audit.ghi(tx, {
        hanhDong: dto.trangThai === 'NGUNG' && cu.trangThai !== 'NGUNG' ? 'NGUNG_XUONG' : 'SUA_XUONG',
        doiTuong: 'xuong',
        doiTuongId: id,
        cu: { ma: cu.ma, ten: cu.ten, trangThai: cu.trangThai },
        moi: { ma: dto.ma, ten: dto.ten, trangThai: dto.trangThai },
      });
      return this.xuongTheoId(tx, id);
    });
  }

  private async xuongTheoId(tx: Tx, id: string): Promise<Xuong> {
    const x = await tx.xuong.findUniqueOrThrow({ where: { id }, include: { _count: { select: { chuyen: true } } } });
    return { id: x.id, ma: x.ma, ten: x.ten, trangThai: x.trangThai, version: x.version, soChuyen: x._count.chuyen };
  }

  // ═══ Chuyền / nhóm ═══

  async dsChuyen(pv: PhamVi, xuongId?: string): Promise<Chuyen[]> {
    if (xuongId && pv.loai === 'XUONG') await this.phamVi.kiemTraXuong(pv, xuongId);
    const loc = this.phamVi.dieuKienChuyen(pv);
    const ds = await this.prisma.chuyen.findMany({
      where: { AND: [loc ?? {}, xuongId ? { xuongId } : {}] },
      orderBy: [{ loai: 'asc' }, { ma: 'asc' }],
      include: { tram: { select: { nhapQuaApp: true, trangThai: true } } },
    });
    return ds.map((c) => this.sangChuyen(c));
  }

  private sangChuyen(c: {
    id: string; ma: string; ten: string; loai: Chuyen['loai']; xuongId: string; trangThai: Chuyen['trangThai']; version: number;
    tram: { nhapQuaApp: boolean; trangThai: string }[];
  }): Chuyen {
    const hoatDong = c.tram.filter((t) => t.trangThai === 'HOAT_DONG');
    return {
      id: c.id, ma: c.ma, ten: c.ten, loai: c.loai, xuongId: c.xuongId, trangThai: c.trangThai, version: c.version,
      soTram: c.tram.length,
      soTramApp: hoatDong.filter((t) => t.nhapQuaApp).length,
    };
  }

  /** Tạo chuyền + tự tạo trạm 1 → N trong 1 thao tác [F9]. Chuyền may: trạm 12, 25, 26–41 mặc định nhập qua app (MVP) */
  async taoChuyen(dto: TaoChuyen): Promise<Chuyen> {
    return this.audit.giaoDich(async (tx) => {
      const xuong = await this.timHoac404(tx.xuong.findUnique({ where: { id: dto.xuongId } }));
      if (xuong.trangThai !== 'HOAT_DONG') {
        throw new LoiNghiepVu('CAP_TREN_DANG_NGUNG', { field: 'xuongId', message: 'Xưởng đang ngưng — kích hoạt xưởng trước.' });
      }
      const c = await this.batTrung(dto.ma, () =>
        tx.chuyen.create({ data: { ma: dto.ma, ten: dto.ten, loai: dto.loai, xuongId: dto.xuongId } }),
      );
      if (dto.soTram > 0) {
        await tx.tram.createMany({
          data: Array.from({ length: dto.soTram }, (_, i) => ({
            chuyenId: c.id,
            soTram: i + 1,
            nhapQuaApp: dto.loai === 'CHUYEN_MAY' && TRAM_NHAP_QUA_APP_MVP.includes(i + 1),
          })),
        });
      }
      await this.audit.ghi(tx, { hanhDong: 'TAO_CHUYEN', doiTuong: 'chuyen', doiTuongId: c.id, moi: dto });
      return this.chuyenTheoId(tx, c.id);
    });
  }

  async suaChuyen(id: string, dauVao: SuaChuyen): Promise<Chuyen> {
    const dto = zSuaChuyen.parse(dauVao);
    return this.audit.giaoDich(async (tx) => {
      // Khóa dòng chuyền: chặn thêm NV / gắn tổ trưởng vào chuyền trong lúc đang ngưng
      await tx.$queryRaw`SELECT 1 FROM chuyen WHERE id = ${id}::uuid FOR UPDATE`;
      const cu = await this.timHoac404(tx.chuyen.findUnique({ where: { id }, include: { xuong: true } }));
      await this.kiemTraVersion(tx, 'chuyen', id, cu, dto.version);

      const ngung = dto.trangThai === 'NGUNG' && cu.trangThai !== 'NGUNG';
      const kichHoat = dto.trangThai === 'HOAT_DONG' && cu.trangThai !== 'HOAT_DONG';
      if (kichHoat && cu.xuong.trangThai !== 'HOAT_DONG') {
        throw new LoiNghiepVu('CAP_TREN_DANG_NGUNG', { message: 'Xưởng đang ngưng — kích hoạt xưởng trước.' });
      }
      if (dto.loai === 'VONG_NGOAI' && cu.loai !== 'VONG_NGOAI' &&
          (await tx.tram.count({ where: { chuyenId: id, nhapQuaApp: true } }))) {
        throw new LoiNghiepVu('VONG_NGOAI_KHONG_NHAP_APP', {
          field: 'loai',
          message: 'Nhóm vòng ngoài không nhập sản lượng qua app — bỏ đánh dấu các trạm trước.',
        });
      }

      let goPhamVi: string[] = [];
      if (ngung) {
        const soNV = await tx.nhanVien.count({ where: { chuyenId: id, trangThai: 'HOAT_DONG' } });
        if (soNV) {
          throw new LoiNghiepVu('CON_NHAN_VIEN_HOAT_DONG', {
            message: `Chuyền còn ${soNV} nhân viên đang hoạt động — chuyển nhân viên sang chuyền khác trước.`,
            chiTiet: { soNhanVien: soNV },
          });
        }
        goPhamVi = await this.kiemTraGoPhamVi(tx, 'chuyen', id, dto.xacNhan, 'tổ trưởng', 'chuyền');
      }

      await this.batTrung(dto.ma, () =>
        tx.chuyen.update({
          where: { id },
          data: { ma: dto.ma, ten: dto.ten, loai: dto.loai, trangThai: dto.trangThai, version: { increment: 1 } },
        }),
      );
      if (ngung) {
        if (goPhamVi.length) {
          await tx.taiKhoanChuyen.deleteMany({ where: { chuyenId: id } });
          await this.audit.ghi(tx, { hanhDong: 'DOI_PHAM_VI', doiTuong: 'chuyen', doiTuongId: id, cu: { taiKhoanIds: goPhamVi }, lyDo: 'Ngưng chuyền' });
        }
        const tramIds = (await tx.tram.findMany({ where: { chuyenId: id }, select: { id: true } })).map((t) => t.id);
        await this.dangXuatPhienCuaTram(tx, tramIds, 'Ngưng chuyền');
      }
      await this.audit.ghi(tx, {
        hanhDong: ngung ? 'NGUNG_CHUYEN' : 'SUA_CHUYEN',
        doiTuong: 'chuyen',
        doiTuongId: id,
        cu: { ma: cu.ma, ten: cu.ten, loai: cu.loai, trangThai: cu.trangThai },
        moi: { ma: dto.ma, ten: dto.ten, loai: dto.loai, trangThai: dto.trangThai },
      });
      return this.chuyenTheoId(tx, id);
    });
  }

  private async chuyenTheoId(tx: Tx, id: string): Promise<Chuyen> {
    const c = await tx.chuyen.findUniqueOrThrow({ where: { id }, include: { tram: { select: { nhapQuaApp: true, trangThai: true } } } });
    return this.sangChuyen(c);
  }

  // ═══ Trạm ═══

  async dsTram(pv: PhamVi, chuyenId: string): Promise<Tram[]> {
    await this.timHoac404(this.prisma.chuyen.findUnique({ where: { id: chuyenId }, select: { id: true } }));
    await this.phamVi.kiemTraChuyen(pv, chuyenId);
    const homNay = ngayDb(this.clock.homNay());
    const ds = await this.prisma.tram.findMany({
      where: { chuyenId },
      orderBy: { soTram: 'asc' },
      include: {
        ganCongDoan: { where: { hieuLucDen: null }, select: { id: true }, take: 1 },
        phienTram: { where: { ngayLamViec: homNay, dangXuatLuc: null }, select: { nhanVien: { select: { maNV: true } } }, take: 1 },
      },
    });
    return ds.map((t) => ({
      id: t.id, chuyenId: t.chuyenId, soTram: t.soTram, nhapQuaApp: t.nhapQuaApp, trangThai: t.trangThai, version: t.version,
      coCongDoanGan: t.ganCongDoan.length > 0,
      maNVDangDangNhap: t.phienTram[0]?.nhanVien.maNV ?? null,
    }));
  }

  async suaTram(id: string, dauVao: SuaTram): Promise<Tram> {
    const dto = zSuaTram.parse(dauVao);
    const chuyenId = await this.audit.giaoDich(async (tx) => {
      // Khóa dòng trạm: chặn gán công đoạn / đăng nhập mới trong lúc đang ngưng
      await tx.$queryRaw`SELECT 1 FROM tram WHERE id = ${id}::uuid FOR UPDATE`;
      const cu = await this.timHoac404(tx.tram.findUnique({ where: { id }, include: { chuyen: true } }));
      await this.kiemTraVersion(tx, 'tram', id, cu, dto.version);

      const ngung = dto.trangThai === 'NGUNG' && cu.trangThai !== 'NGUNG';
      const boApp = dto.nhapQuaApp === false && cu.nhapQuaApp;
      if (dto.trangThai === 'HOAT_DONG' && cu.trangThai !== 'HOAT_DONG' && cu.chuyen.trangThai !== 'HOAT_DONG') {
        throw new LoiNghiepVu('CAP_TREN_DANG_NGUNG', { message: 'Chuyền đang ngưng — kích hoạt chuyền trước.' });
      }
      if (dto.nhapQuaApp && cu.chuyen.loai === 'VONG_NGOAI') {
        throw new LoiNghiepVu('VONG_NGOAI_KHONG_NHAP_APP', { field: 'nhapQuaApp', message: 'Nhóm vòng ngoài không nhập sản lượng qua app.' });
      }
      // Ngưng / bỏ nhập qua app → trạm biến mất khỏi sơ đồ gán: phải gỡ công đoạn trước [F9]
      if ((ngung || boApp) && (await tx.ganCongDoan.count({ where: { tramId: id, hieuLucDen: null } }))) {
        throw new LoiNghiepVu('CON_CONG_DOAN_GAN');
      }

      await tx.tram.update({
        where: { id },
        data: { nhapQuaApp: dto.nhapQuaApp, trangThai: dto.trangThai, version: { increment: 1 } },
      });
      if (ngung || boApp) await this.dangXuatPhienCuaTram(tx, [id], ngung ? 'Ngưng trạm' : 'Bỏ nhập qua app');
      await this.audit.ghi(tx, {
        hanhDong: ngung ? 'NGUNG_TRAM' : 'SUA_TRAM',
        doiTuong: 'tram',
        doiTuongId: id,
        cu: { nhapQuaApp: cu.nhapQuaApp, trangThai: cu.trangThai },
        moi: { nhapQuaApp: dto.nhapQuaApp, trangThai: dto.trangThai },
      });
      return cu.chuyenId;
    });
    const tram = (await this.dsTram({ loai: 'TOAN_NHA_MAY' }, chuyenId)).find((t) => t.id === id);
    return tram!;
  }

  // ═══ Dùng chung ═══

  /**
   * Ngưng xưởng/chuyền còn tài khoản được gắn [R 5.10]:
   * tài khoản chỉ còn đúng phạm vi này → chặn; còn lại → cảnh báo (409 CAN_XAC_NHAN), xác nhận thì trả danh sách để gỡ.
   */
  private async kiemTraGoPhamVi(
    tx: Tx, loai: 'xuong' | 'chuyen', id: string, xacNhan: boolean, tenVaiTro: string, tenPhamVi: string,
  ): Promise<string[]> {
    const gan =
      loai === 'xuong'
        ? await tx.taiKhoanXuong.findMany({
            where: { xuongId: id },
            include: { taiKhoan: { select: { id: true, hoTen: true, _count: { select: { taiKhoanXuong: true } } } } },
          })
        : await tx.taiKhoanChuyen.findMany({
            where: { chuyenId: id },
            include: { taiKhoan: { select: { id: true, hoTen: true, _count: { select: { taiKhoanChuyen: true } } } } },
          });
    if (!gan.length) return [];
    const tk = gan.map((g) => ({
      id: g.taiKhoan.id,
      hoTen: g.taiKhoan.hoTen,
      soPhamVi: 'taiKhoanXuong' in g.taiKhoan._count ? g.taiKhoan._count.taiKhoanXuong : g.taiKhoan._count.taiKhoanChuyen,
    }));
    const chiCon = tk.filter((t) => t.soPhamVi <= 1);
    if (chiCon.length) {
      throw new LoiNghiepVu('PHAI_GAN_PHAM_VI', {
        message: `${chiCon.map((t) => t.hoTen).join(', ')} chỉ phụ trách ${tenPhamVi} này — gắn ${tenPhamVi} khác cho tài khoản trước khi ngưng.`,
        chiTiet: { danhSach: chiCon.map((t) => t.hoTen) },
      });
    }
    if (!xacNhan) {
      throw new LoiNghiepVu('CAN_XAC_NHAN', {
        message: `Ngưng ${tenPhamVi} sẽ gỡ ${tenPhamVi} này khỏi ${tk.length} ${tenVaiTro}.`,
        chiTiet: { canhBao: `Các ${tenVaiTro} sau sẽ không còn phụ trách ${tenPhamVi} này:`, danhSach: tk.map((t) => t.hoTen) },
      });
    }
    return tk.map((t) => t.id);
  }

  /** Ngưng trạm/chuyền đang có công nhân đăng nhập → tự đăng xuất [F9] (ghi như đăng xuất hộ, kèm lý do) */
  private async dangXuatPhienCuaTram(tx: Tx, tramIds: string[], lyDo: string): Promise<void> {
    if (!tramIds.length) return;
    const nguoi = this.audit.nguCanh().nguoiThucHienId;
    const { count } = await tx.phienTram.updateMany({
      where: { tramId: { in: tramIds }, dangXuatLuc: null },
      data: { dangXuatLuc: this.clock.now(), lyDoDong: 'DANG_XUAT_HO', dangXuatBoiId: nguoi, lyDo },
    });
    if (count) {
      await this.audit.ghi(tx, { hanhDong: 'DANG_XUAT_HO', doiTuong: 'tram', doiTuongId: tramIds.length === 1 ? tramIds[0] : null, moi: { soPhien: count }, lyDo });
    }
  }

  private async kiemTraVersion(tx: Tx, doiTuong: string, id: string, cu: CoVersion, version: number): Promise<void> {
    if (cu.version !== version) throw await this.audit.loiDaThayDoi(tx, doiTuong, id);
  }

  private async timHoac404<T>(p: Promise<T | null>): Promise<T> {
    const v = await p;
    if (!v) throw new LoiNghiepVu('KHONG_TIM_THAY');
    return v;
  }

  private async batTrung<T>(ma: string | undefined, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (laLoiTrung(e)) throw new LoiNghiepVu('TRUNG_MA', { field: 'ma', message: `Mã ${ma ?? ''} đã tồn tại.` });
      throw e;
    }
  }
}
