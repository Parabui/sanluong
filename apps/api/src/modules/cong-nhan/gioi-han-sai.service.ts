import { Injectable } from '@nestjs/common';
import { dinhDangGio } from '@vsn/shared';
import { ClockService } from '../../core/clock/clock.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';

/** Sai 10 lần / 10 phút / thiết bị → khóa đăng nhập trạm 15 phút [R 3.5] [D23] */
export const SO_LAN_SAI_TRAM = 10;
const CUA_SO_MS = 10 * 60_000;
const KHOA_MS = 15 * 60_000;

/**
 * Bộ đếm sai mã NV theo THIẾT BỊ — KHÔNG theo IP (4G dùng CGNAT: nhiều thuê bao chung IP) [TDD 9.4].
 * Lưu trong bộ nhớ (1 tiến trình API); khởi động lại thì reset — chấp nhận được.
 * Chưa có cookie thiết bị → chỉ dựa vào Turnstile + rate rule Cloudflare.
 */
@Injectable()
export class GioiHanSaiService {
  private readonly bo = new Map<string, { lan: number[]; khoaDen?: number }>();

  constructor(private readonly clock: ClockService) {}

  kiemTra(thietBiId: string | undefined): void {
    if (!thietBiId) return;
    const x = this.bo.get(thietBiId);
    const now = this.clock.now().getTime();
    if (x?.khoaDen && x.khoaDen > now) {
      throw new LoiNghiepVu('QUA_SO_LAN_SAI', {
        message: `Nhập sai mã NV quá ${SO_LAN_SAI_TRAM} lần — thử lại sau ${dinhDangGio(new Date(x.khoaDen))}.`,
        chiTiet: { khoaDen: new Date(x.khoaDen).toISOString() },
      });
    }
  }

  ghiSai(thietBiId: string | undefined): void {
    if (!thietBiId) return;
    const now = this.clock.now().getTime();
    const x = this.bo.get(thietBiId) ?? { lan: [] };
    x.lan = [...x.lan.filter((t) => now - t < CUA_SO_MS), now];
    if (x.lan.length >= SO_LAN_SAI_TRAM) {
      x.khoaDen = now + KHOA_MS;
      x.lan = [];
    }
    if (this.bo.size > 50_000) this.bo.clear();
    this.bo.set(thietBiId, x);
  }

  xoa(thietBiId: string): void {
    this.bo.delete(thietBiId);
  }
}
