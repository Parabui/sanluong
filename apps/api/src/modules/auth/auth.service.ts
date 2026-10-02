import { Injectable } from '@nestjs/common';
import { type DangNhap, type DoiMatKhau, dinhDangGio, type TaiKhoanToi } from '@vsn/shared';
import { compare, hash } from 'bcryptjs';
import type { Request } from 'express';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { layIp } from '../../core/http/ip.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import type { NguCanhAudit, TaiKhoanPhien } from '../../core/ngu-canh.js';
import { PhienWebService } from '../../core/phien/phien-web.service.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { PhamViService } from '../../core/quyen/pham-vi.service.js';
import { QuyenService } from '../../core/quyen/quyen.service.js';

/** bcrypt cost 12 [TDD 5] */
export const BCRYPT_COST = 12;
/** Sai 5 lần → khóa 15 phút [F8] */
export const SO_LAN_SAI_TOI_DA = 5;
export const THOI_GIAN_KHOA_MS = 15 * 60 * 1000;
/** So với hash giả khi tên đăng nhập không tồn tại → thời gian phản hồi như nhau, không lộ tài khoản có tồn tại */
let hashGia: Promise<string> | undefined;
const layHashGia = () => (hashGia ??= hash('khong-phai-mat-khau', BCRYPT_COST));

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly audit: AuditService,
    private readonly phien: PhienWebService,
    private readonly quyen: QuyenService,
    private readonly phamVi: PhamViService,
  ) {}

  async dangNhap(dto: DangNhap, req: Request): Promise<{ token: string; loai: 'WEB' | 'TV'; toi: TaiKhoanToi }> {
    const tk = await this.prisma.taiKhoan.findUnique({ where: { tenDangNhap: dto.tenDangNhap } });
    const nguCanh = (id: string | null): NguCanhAudit => ({
      loaiNguoiThucHien: id ? 'TAI_KHOAN' : 'HE_THONG',
      nguoiThucHienId: id,
      ip: layIp(req),
      traceId: this.audit.nguCanh().traceId,
    });
    const ghiThatBai = (id: string | null, lyDo: string) =>
      this.audit.giaoDich(
        (tx) => this.audit.ghi(tx, { hanhDong: 'DANG_NHAP_THAT_BAI', doiTuong: 'tai_khoan', doiTuongId: id, moi: { tenDangNhap: dto.tenDangNhap }, lyDo }, nguCanh(id)),
        nguCanh(id),
      );

    if (!tk) {
      await compare(dto.matKhau, await layHashGia());
      await ghiThatBai(null, 'KHONG_TON_TAI');
      throw new LoiNghiepVu('SAI_DANG_NHAP');
    }

    const now = this.clock.now();
    if (tk.khoaDen && tk.khoaDen > now) {
      throw new LoiNghiepVu('QUA_SO_LAN_SAI', {
        message: `Sai mật khẩu ${SO_LAN_SAI_TOI_DA} lần — tài khoản bị khóa đến ${dinhDangGio(tk.khoaDen)}.`,
        chiTiet: { khoaDen: tk.khoaDen.toISOString() },
      });
    }

    if (!(await compare(dto.matKhau, tk.matKhauHash))) {
      const sau = await this.prisma.taiKhoan.update({
        where: { id: tk.id },
        data: { soLanSai: { increment: 1 } },
        select: { soLanSai: true },
      });
      if (sau.soLanSai >= SO_LAN_SAI_TOI_DA) {
        const khoaDen = new Date(now.getTime() + THOI_GIAN_KHOA_MS);
        await this.prisma.taiKhoan.update({ where: { id: tk.id }, data: { soLanSai: 0, khoaDen } });
        await ghiThatBai(tk.id, 'KHOA_15_PHUT');
        throw new LoiNghiepVu('QUA_SO_LAN_SAI', {
          message: `Sai mật khẩu ${SO_LAN_SAI_TOI_DA} lần — tài khoản bị khóa đến ${dinhDangGio(khoaDen)}.`,
          chiTiet: { khoaDen: khoaDen.toISOString() },
        });
      }
      await ghiThatBai(tk.id, 'SAI_MAT_KHAU');
      throw new LoiNghiepVu('SAI_DANG_NHAP');
    }

    // Mật khẩu đúng: kiểm tra trạng thái SAU khi xác thực để không lộ tài khoản bị vô hiệu cho người đoán mò
    if (tk.trangThai !== 'HOAT_DONG') {
      await ghiThatBai(tk.id, 'VO_HIEU_HOA');
      throw new LoiNghiepVu('TAI_KHOAN_VO_HIEU');
    }
    const loai = tk.vaiTro === 'TV' ? 'TV' : 'WEB';
    if (loai === 'TV' && !(await this.phien.ipNhaMayHopLe(req))) {
      await ghiThatBai(tk.id, 'TV_NGOAI_NHA_MAY');
      throw new LoiNghiepVu('KHONG_CO_QUYEN', { message: 'Tài khoản TV chỉ đăng nhập được trong mạng nhà máy.' });
    }

    const token = await this.phien.tao(tk.id, loai, req);
    await this.audit.giaoDich(async (tx) => {
      await tx.taiKhoan.update({ where: { id: tk.id }, data: { soLanSai: 0, khoaDen: null } });
      await this.audit.ghi(tx, { hanhDong: 'DANG_NHAP_WEB', doiTuong: 'tai_khoan', doiTuongId: tk.id, moi: { loai } }, nguCanh(tk.id));
    }, nguCanh(tk.id));

    return { token, loai, toi: await this.toi(tk) };
  }

  async dangXuat(tk: TaiKhoanPhien): Promise<void> {
    await this.phien.xoa(tk.phienId);
    await this.audit.giaoDich((tx) =>
      this.audit.ghi(tx, { hanhDong: 'DANG_XUAT_WEB', doiTuong: 'tai_khoan', doiTuongId: tk.id }),
    );
  }

  async doiMatKhau(tk: TaiKhoanPhien, dto: DoiMatKhau): Promise<TaiKhoanToi> {
    const hienTai = await this.prisma.taiKhoan.findUniqueOrThrow({ where: { id: tk.id } });
    if (!(await compare(dto.matKhauHienTai, hienTai.matKhauHash))) {
      throw new LoiNghiepVu('MAT_KHAU_HIEN_TAI_SAI', { field: 'matKhauHienTai' });
    }
    const matKhauHash = await hash(dto.matKhauMoi, BCRYPT_COST);
    const sau = await this.audit.giaoDich(async (tx) => {
      const sau = await tx.taiKhoan.update({
        where: { id: tk.id },
        data: { matKhauHash, phaiDoiMatKhau: false, version: { increment: 1 } },
      });
      // KHÔNG ghi mật khẩu / hash vào audit
      await this.audit.ghi(tx, { hanhDong: 'DOI_MAT_KHAU', doiTuong: 'tai_khoan', doiTuongId: tk.id });
      return sau;
    });
    await this.phien.xoaPhienKhac(tk.id, tk.phienId);
    return this.toi(sau);
  }

  async toi(tk: { id: string; tenDangNhap: string; hoTen: string; vaiTro: TaiKhoanToi['vaiTro']; phaiDoiMatKhau: boolean }): Promise<TaiKhoanToi> {
    const phamVi = await this.phamVi.cuaTaiKhoan(tk.id, tk.vaiTro);
    return {
      id: tk.id,
      tenDangNhap: tk.tenDangNhap,
      hoTen: tk.hoTen,
      vaiTro: tk.vaiTro,
      chucNang: await this.quyen.chucNangCua(tk.vaiTro),
      phamVi,
      tenPhamVi: await this.phamVi.tenHienThi(phamVi),
      phaiDoiMatKhau: tk.phaiDoiMatKhau,
    };
  }
}
