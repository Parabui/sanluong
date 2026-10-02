import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { COOKIE_PHIEN, HEADER_POLLING } from '@vsn/shared';
import type { CookieOptions, Request, Response } from 'express';
import { CauHinhService } from '../cau-hinh/cau-hinh.service.js';
import { ClockService } from '../clock/clock.service.js';
import { layIp } from '../http/ip.js';
import { LoiNghiepVu } from '../loi/loi-nghiep-vu.js';
import type { TaiKhoanPhien } from '../ngu-canh.js';
import { PrismaService } from '../prisma/prisma.service.js';

const GIO = 60 * 60 * 1000;
/** WEB: 8 giờ không thao tác [F8] + tối đa 12 giờ kể từ lúc đăng nhập [D24] */
export const HET_HAN_KHONG_THAO_TAC_MS = 8 * GIO;
export const HET_HAN_TOI_DA_MS = 12 * GIO;
/** Gia hạn `lanCuoi` tối đa 1 lần / phút — tránh ghi DB ở mọi request */
const CHU_KY_GIA_HAN_MS = 60 * 1000;

const COOKIE: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/api' };

export const bamToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Phiên Web/TV lưu ở server [D6] [TDD 9.2]: cookie `vsn_sid` chứa token ngẫu nhiên 32 byte,
 * DB chỉ giữ SHA-256 của token. Thu hồi = xóa dòng PhienDangNhap.
 */
@Injectable()
export class PhienWebService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
    private readonly cauHinh: CauHinhService,
  ) {}

  async tao(taiKhoanId: string, loai: 'WEB' | 'TV', req: Request): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const now = this.clock.now();
    await this.prisma.phienDangNhap.create({
      data: {
        tokenHash: bamToken(token),
        taiKhoanId,
        loai,
        taoLuc: now,
        lanCuoi: now,
        ip: layIp(req),
        userAgent: req.header('user-agent')?.slice(0, 300) ?? null,
      },
    });
    return token;
  }

  datCookie(res: Response, token: string, loai: 'WEB' | 'TV'): void {
    // TV: cookie sống lâu (phiên không hết hạn, chỉ thu hồi được); WEB: cookie phiên trình duyệt
    res.cookie(COOKIE_PHIEN, token, loai === 'TV' ? { ...COOKIE, maxAge: 400 * 24 * GIO } : COOKIE);
  }

  xoaCookie(res: Response): void {
    res.clearCookie(COOKIE_PHIEN, COOKIE);
  }

  /** TV chỉ hợp lệ khi request đến từ IP public của nhà máy [D24] */
  async ipNhaMayHopLe(req: Request): Promise<boolean> {
    const ds = await this.cauHinh.doc('ipNhaMay');
    return ds.includes(layIp(req));
  }

  /**
   * Phiên của request: không có cookie → null; có nhưng không hợp lệ / hết hạn → 401 (và xóa phiên hết hạn).
   */
  async xacThuc(req: Request): Promise<TaiKhoanPhien | null> {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[COOKIE_PHIEN];
    if (!token) return null;

    const phien = await this.prisma.phienDangNhap.findUnique({
      where: { tokenHash: bamToken(token) },
      include: { taiKhoan: true },
    });
    if (!phien) throw new LoiNghiepVu('PHIEN_HET_HAN');

    const now = this.clock.now().getTime();
    const tk = phien.taiKhoan;
    let hetHan = tk.trangThai !== 'HOAT_DONG';
    if (phien.loai === 'WEB') {
      hetHan ||= now - phien.lanCuoi.getTime() > HET_HAN_KHONG_THAO_TAC_MS;
      hetHan ||= now - phien.taoLuc.getTime() > HET_HAN_TOI_DA_MS;
    } else if (!(await this.ipNhaMayHopLe(req))) {
      // TV ngoài mạng nhà máy: từ chối nhưng KHÔNG xóa phiên (TV mang về xưởng vẫn dùng tiếp)
      throw new LoiNghiepVu('PHIEN_HET_HAN', { message: 'Tài khoản TV chỉ dùng được trong mạng nhà máy.' });
    }
    if (hetHan) {
      await this.prisma.phienDangNhap.deleteMany({ where: { id: phien.id } });
      throw new LoiNghiepVu('PHIEN_HET_HAN');
    }

    // Request polling (X-VSN-Polling: 1) KHÔNG gia hạn phiên [D24]
    const polling = req.header(HEADER_POLLING) === '1';
    if (!polling && now - phien.lanCuoi.getTime() > CHU_KY_GIA_HAN_MS) {
      await this.prisma.phienDangNhap.updateMany({ where: { id: phien.id }, data: { lanCuoi: new Date(now) } });
    }

    return {
      id: tk.id,
      tenDangNhap: tk.tenDangNhap,
      hoTen: tk.hoTen,
      vaiTro: tk.vaiTro,
      phaiDoiMatKhau: tk.phaiDoiMatKhau,
      phienId: phien.id,
    };
  }

  async xoa(phienId: string): Promise<void> {
    await this.prisma.phienDangNhap.deleteMany({ where: { id: phienId } });
  }

  /** Đổi mật khẩu → xóa mọi phiên KHÁC của tài khoản [TDD 9.2] */
  async xoaPhienKhac(taiKhoanId: string, giuPhienId: string): Promise<void> {
    await this.prisma.phienDangNhap.deleteMany({ where: { taiKhoanId, id: { not: giuPhienId } } });
  }
}
