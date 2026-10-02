import { Injectable } from '@nestjs/common';
import {
  CHUC_NANG,
  type ChucNang,
  type DatLaiMatKhau,
  lyDoKhoaQuyen,
  PHAM_VI_CUA_VAI_TRO,
  type SuaQuyen,
  type SuaTaiKhoan,
  type TaiKhoan,
  type TaoTaiKhoan,
  VAI_TRO,
  type VaiTro,
  zSuaTaiKhoan,
  zTaoTaiKhoan,
} from '@vsn/shared';
import { hash } from 'bcryptjs';
import { AuditService } from '../../core/audit/audit.service.js';
import { laLoiTrung } from '../../core/loi/loi-db.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';
import { QuyenService } from '../../core/quyen/quyen.service.js';
import { BCRYPT_COST } from '../auth/auth.service.js';

const CHON = {
  id: true, tenDangNhap: true, hoTen: true, vaiTro: true, trangThai: true, phaiDoiMatKhau: true, khoaDen: true, version: true,
  taiKhoanChuyen: { select: { chuyenId: true } },
  taiKhoanXuong: { select: { xuongId: true } },
} as const;

export interface OQuyenDay {
  vaiTro: VaiTro;
  chucNang: ChucNang;
  batTat: boolean;
  /** Ô không sửa được → lý do */
  lyDoKhoa: string | null;
}

/**
 * Tài khoản & phân quyền · F8.
 * Vai trò = được làm chức năng gì (ma trận QuyenVaiTro, Superadmin bật/tắt) · Phạm vi = thấy dữ liệu nào (gắn theo tài khoản).
 */
@Injectable()
export class TaiKhoanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly quyen: QuyenService,
  ) {}

  async ds(): Promise<TaiKhoan[]> {
    const [ds, dangNhap] = await Promise.all([
      this.prisma.taiKhoan.findMany({ select: CHON, orderBy: [{ trangThai: 'asc' }, { vaiTro: 'asc' }, { tenDangNhap: 'asc' }] }),
      this.prisma.auditLog.groupBy({
        by: ['doiTuongId'],
        where: { hanhDong: 'DANG_NHAP_WEB', doiTuong: 'tai_khoan' },
        _max: { luc: true },
      }),
    ]);
    const lanCuoi = new Map(dangNhap.map((d) => [d.doiTuongId, d._max.luc]));
    const tenChuyen = new Map((await this.prisma.chuyen.findMany({ select: { id: true, ma: true } })).map((c) => [c.id, c.ma]));
    const tenXuong = new Map((await this.prisma.xuong.findMany({ select: { id: true, ten: true } })).map((x) => [x.id, x.ten]));
    return ds.map((t) => this.sangTaiKhoan(t, lanCuoi.get(t.id) ?? null, tenChuyen, tenXuong));
  }

  private sangTaiKhoan(
    t: { id: string; tenDangNhap: string; hoTen: string; vaiTro: VaiTro; trangThai: TaiKhoan['trangThai']; phaiDoiMatKhau: boolean; khoaDen: Date | null; version: number; taiKhoanChuyen: { chuyenId: string }[]; taiKhoanXuong: { xuongId: string }[] },
    lanCuoi: Date | null,
    tenChuyen: Map<string, string>,
    tenXuong: Map<string, string>,
  ): TaiKhoan {
    const chuyenIds = t.taiKhoanChuyen.map((c) => c.chuyenId);
    const xuongIds = t.taiKhoanXuong.map((x) => x.xuongId);
    const pv = PHAM_VI_CUA_VAI_TRO[t.vaiTro];
    const tenPhamVi =
      pv === 'CHUYEN' ? chuyenIds.map((id) => tenChuyen.get(id) ?? '?').sort().join(', ')
        : pv === 'XUONG' ? xuongIds.map((id) => tenXuong.get(id) ?? '?').sort().join(', ')
          : 'Toàn nhà máy';
    return {
      id: t.id, tenDangNhap: t.tenDangNhap, hoTen: t.hoTen, vaiTro: t.vaiTro, trangThai: t.trangThai,
      chuyenIds, xuongIds, tenPhamVi,
      lanDangNhapCuoi: lanCuoi?.toISOString() ?? null,
      khoaDen: t.khoaDen?.toISOString() ?? null,
      phaiDoiMatKhau: t.phaiDoiMatKhau,
      version: t.version,
    };
  }

  private async motTaiKhoan(tx: Tx, id: string): Promise<TaiKhoan> {
    const t = await tx.taiKhoan.findUniqueOrThrow({ where: { id }, select: CHON });
    const lanCuoi = await tx.auditLog.findFirst({ where: { hanhDong: 'DANG_NHAP_WEB', doiTuongId: id }, orderBy: { luc: 'desc' }, select: { luc: true } });
    const tenChuyen = new Map((await tx.chuyen.findMany({ where: { id: { in: t.taiKhoanChuyen.map((c) => c.chuyenId) } }, select: { id: true, ma: true } })).map((c) => [c.id, c.ma]));
    const tenXuong = new Map((await tx.xuong.findMany({ where: { id: { in: t.taiKhoanXuong.map((x) => x.xuongId) } }, select: { id: true, ten: true } })).map((x) => [x.id, x.ten]));
    return this.sangTaiKhoan(t, lanCuoi?.luc ?? null, tenChuyen, tenXuong);
  }

  async tao(dauVao: TaoTaiKhoan): Promise<TaiKhoan> {
    const dto = zTaoTaiKhoan.parse(dauVao);
    const pv = PHAM_VI_CUA_VAI_TRO[dto.vaiTro];
    const chuyenIds = pv === 'CHUYEN' ? [...new Set(dto.chuyenIds)] : [];
    const xuongIds = pv === 'XUONG' ? [...new Set(dto.xuongIds)] : [];
    const matKhauHash = await hash(dto.matKhauTam, BCRYPT_COST);
    return this.audit.giaoDich(async (tx) => {
      await this.kiemTraPhamViTonTai(tx, chuyenIds, xuongIds);
      let id: string;
      try {
        ({ id } = await tx.taiKhoan.create({
          data: {
            tenDangNhap: dto.tenDangNhap,
            hoTen: dto.hoTen,
            matKhauHash,
            vaiTro: dto.vaiTro,
            phaiDoiMatKhau: true, // lần đầu đăng nhập bắt buộc đổi mật khẩu [F8]
            taiKhoanChuyen: { create: chuyenIds.map((chuyenId) => ({ chuyenId })) },
            taiKhoanXuong: { create: xuongIds.map((xuongId) => ({ xuongId })) },
          },
          select: { id: true },
        }));
      } catch (e) {
        if (laLoiTrung(e)) throw new LoiNghiepVu('TRUNG_MA', { field: 'tenDangNhap', message: `Tên đăng nhập ${dto.tenDangNhap} đã tồn tại.` });
        throw e;
      }
      await this.audit.ghi(tx, {
        hanhDong: 'TAO_TAI_KHOAN',
        doiTuong: 'tai_khoan',
        doiTuongId: id,
        moi: { tenDangNhap: dto.tenDangNhap, hoTen: dto.hoTen, vaiTro: dto.vaiTro, chuyenIds, xuongIds },
      });
      return this.motTaiKhoan(tx, id);
    });
  }

  async sua(id: string, dauVao: SuaTaiKhoan): Promise<TaiKhoan> {
    const dto = zSuaTaiKhoan.parse(dauVao);
    return this.audit.giaoDich(async (tx) => {
      // Khóa mọi dòng Superadmin: 2 Superadmin cùng hạ quyền nhau không thể cùng lọt kiểm tra "còn ≥ 1"
      await tx.$queryRaw`SELECT 1 FROM tai_khoan WHERE vai_tro = 'SUPERADMIN' OR id = ${id}::uuid ORDER BY id FOR UPDATE`;
      const cu = await tx.taiKhoan.findUnique({ where: { id }, select: CHON });
      if (!cu) throw new LoiNghiepVu('KHONG_TIM_THAY');
      if (cu.version !== dto.version) throw await this.audit.loiDaThayDoi(tx, 'tai_khoan', id);

      const vaiTro = dto.vaiTro ?? cu.vaiTro;
      const trangThai = dto.trangThai ?? cu.trangThai;
      const pv = PHAM_VI_CUA_VAI_TRO[vaiTro];
      // Phạm vi mới: gửi kèm thì dùng, không gửi thì giữ (nếu vai trò vẫn cùng loại phạm vi)
      const chuyenIds = pv === 'CHUYEN' ? [...new Set(dto.chuyenIds ?? cu.taiKhoanChuyen.map((c) => c.chuyenId))] : [];
      const xuongIds = pv === 'XUONG' ? [...new Set(dto.xuongIds ?? cu.taiKhoanXuong.map((x) => x.xuongId))] : [];
      if ((pv === 'CHUYEN' && !chuyenIds.length) || (pv === 'XUONG' && !xuongIds.length)) {
        throw new LoiNghiepVu('PHAI_GAN_PHAM_VI', {
          field: pv === 'CHUYEN' ? 'chuyenIds' : 'xuongIds',
          message: pv === 'CHUYEN' ? 'Phải gắn ít nhất 1 chuyền.' : 'Phải gắn ít nhất 1 xưởng.',
        });
      }
      await this.kiemTraPhamViTonTai(tx, chuyenIds.filter((c) => !cu.taiKhoanChuyen.some((x) => x.chuyenId === c)), xuongIds.filter((x) => !cu.taiKhoanXuong.some((y) => y.xuongId === x)));

      // Luôn còn ít nhất 1 Superadmin đang hoạt động [F8]
      const mat = cu.vaiTro === 'SUPERADMIN' && cu.trangThai === 'HOAT_DONG' && (vaiTro !== 'SUPERADMIN' || trangThai !== 'HOAT_DONG');
      if (mat && !(await tx.taiKhoan.count({ where: { vaiTro: 'SUPERADMIN', trangThai: 'HOAT_DONG', id: { not: id } } }))) {
        throw new LoiNghiepVu('SUPERADMIN_CUOI_CUNG');
      }

      await tx.taiKhoan.update({ where: { id }, data: { hoTen: dto.hoTen, vaiTro, trangThai, version: { increment: 1 } } });

      const chuyenCu = cu.taiKhoanChuyen.map((c) => c.chuyenId).sort();
      const xuongCu = cu.taiKhoanXuong.map((x) => x.xuongId).sort();
      const doiPhamVi = JSON.stringify(chuyenCu) !== JSON.stringify([...chuyenIds].sort()) || JSON.stringify(xuongCu) !== JSON.stringify([...xuongIds].sort());
      if (doiPhamVi) {
        await tx.taiKhoanChuyen.deleteMany({ where: { taiKhoanId: id } });
        await tx.taiKhoanXuong.deleteMany({ where: { taiKhoanId: id } });
        if (chuyenIds.length) await tx.taiKhoanChuyen.createMany({ data: chuyenIds.map((chuyenId) => ({ taiKhoanId: id, chuyenId })) });
        if (xuongIds.length) await tx.taiKhoanXuong.createMany({ data: xuongIds.map((xuongId) => ({ taiKhoanId: id, xuongId })) });
        await this.audit.ghi(tx, { hanhDong: 'DOI_PHAM_VI', doiTuong: 'tai_khoan', doiTuongId: id, cu: { chuyenIds: chuyenCu, xuongIds: xuongCu }, moi: { chuyenIds, xuongIds } });
      }
      // Vô hiệu hóa → xóa mọi phiên: đăng xuất ở lần thao tác kế tiếp [F8]
      const voHieu = trangThai === 'NGUNG' && cu.trangThai !== 'NGUNG';
      if (voHieu) await tx.phienDangNhap.deleteMany({ where: { taiKhoanId: id } });

      await this.audit.ghi(tx, {
        hanhDong: voHieu ? 'VO_HIEU_HOA_TAI_KHOAN' : 'SUA_TAI_KHOAN',
        doiTuong: 'tai_khoan',
        doiTuongId: id,
        cu: { hoTen: cu.hoTen, vaiTro: cu.vaiTro, trangThai: cu.trangThai },
        moi: { hoTen: dto.hoTen, vaiTro, trangThai },
      });
      return this.motTaiKhoan(tx, id);
    });
  }

  /** Superadmin đặt lại mật khẩu → bắt buộc đổi ở lần đăng nhập sau; mở khóa sai mật khẩu; thu hồi mọi phiên [F8] */
  async datLaiMatKhau(id: string, dto: DatLaiMatKhau): Promise<TaiKhoan> {
    const matKhauHash = await hash(dto.matKhauTam, BCRYPT_COST);
    return this.audit.giaoDich(async (tx) => {
      const { count } = await tx.taiKhoan.updateMany({
        where: { id },
        data: { matKhauHash, phaiDoiMatKhau: true, soLanSai: 0, khoaDen: null, version: { increment: 1 } },
      });
      if (!count) throw new LoiNghiepVu('KHONG_TIM_THAY');
      await tx.phienDangNhap.deleteMany({ where: { taiKhoanId: id } });
      await this.audit.ghi(tx, { hanhDong: 'DAT_LAI_MAT_KHAU', doiTuong: 'tai_khoan', doiTuongId: id });
      return this.motTaiKhoan(tx, id);
    });
  }

  /** Thu hồi phiên (dùng cho TV) — bắt buộc đăng nhập lại [R 5.12] */
  async thuHoiPhien(id: string): Promise<{ soPhien: number }> {
    return this.audit.giaoDich(async (tx) => {
      if (!(await tx.taiKhoan.count({ where: { id } }))) throw new LoiNghiepVu('KHONG_TIM_THAY');
      const { count } = await tx.phienDangNhap.deleteMany({ where: { taiKhoanId: id } });
      await this.audit.ghi(tx, { hanhDong: 'THU_HOI_PHIEN', doiTuong: 'tai_khoan', doiTuongId: id, moi: { soPhien: count } });
      return { soPhien: count };
    });
  }

  private async kiemTraPhamViTonTai(tx: Tx, chuyenIds: string[], xuongIds: string[]): Promise<void> {
    if (chuyenIds.length && (await tx.chuyen.count({ where: { id: { in: chuyenIds }, trangThai: 'HOAT_DONG' } })) !== chuyenIds.length) {
      throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', { field: 'chuyenIds', message: 'Có chuyền không tồn tại hoặc đã ngưng.' });
    }
    if (xuongIds.length && (await tx.xuong.count({ where: { id: { in: xuongIds }, trangThai: 'HOAT_DONG' } })) !== xuongIds.length) {
      throw new LoiNghiepVu('DU_LIEU_KHONG_HOP_LE', { field: 'xuongIds', message: 'Có xưởng không tồn tại hoặc đã ngưng.' });
    }
  }

  // ═══ Ma trận quyền ═══

  async maTran(): Promise<OQuyenDay[]> {
    const dong = await this.prisma.quyenVaiTro.findMany();
    const bat = new Set(dong.filter((d) => d.batTat).map((d) => `${d.vaiTro}|${d.chucNang}`));
    return VAI_TRO.flatMap((vaiTro) =>
      CHUC_NANG.map((chucNang) => ({ vaiTro, chucNang, batTat: bat.has(`${vaiTro}|${chucNang}`), lyDoKhoa: lyDoKhoaQuyen(vaiTro, chucNang) })),
    );
  }

  /** Superadmin bật/tắt chức năng theo vai trò — có hiệu lực ngay (xóa cache), ghi lịch sử [F8] */
  async suaMaTran(dto: SuaQuyen): Promise<OQuyenDay[]> {
    for (const o of dto.thayDoi) {
      const lyDo = lyDoKhoaQuyen(o.vaiTro, o.chucNang);
      if (lyDo) throw new LoiNghiepVu('KHONG_CO_QUYEN', { message: `${lyDo}.` });
    }
    await this.audit.giaoDich(async (tx) => {
      const cu = await tx.quyenVaiTro.findMany();
      const truoc = new Map(cu.map((d) => [`${d.vaiTro}|${d.chucNang}`, d.batTat]));
      const doi = dto.thayDoi.filter((o) => (truoc.get(`${o.vaiTro}|${o.chucNang}`) ?? false) !== o.batTat);
      for (const o of doi) {
        await tx.quyenVaiTro.upsert({
          where: { vaiTro_chucNang: { vaiTro: o.vaiTro, chucNang: o.chucNang } },
          create: o,
          update: { batTat: o.batTat },
        });
      }
      if (doi.length) await this.audit.ghi(tx, { hanhDong: 'DOI_QUYEN_VAI_TRO', doiTuong: 'quyen_vai_tro', moi: { thayDoi: doi } });
    });
    this.quyen.xoaCache();
    return this.maTran();
  }

}
