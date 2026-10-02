import { Inject, Injectable, Logger } from '@nestjs/common';
import { MOI_TRUONG, type MoiTruong } from '../../core/moi-truong.js';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Cloudflare Turnstile (chế độ ẩn) cho đăng nhập trạm — chặn bot dò mã NV từ Internet [D23] [TDD 3.3].
 * Dev/test không cấu hình TURNSTILE_SECRET → bỏ qua; production thiếu secret → từ chối (không mở cửa im lặng).
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(@Inject(MOI_TRUONG) private readonly env: MoiTruong) {}

  async hopLe(token: string, ip: string): Promise<boolean> {
    if (!this.env.TURNSTILE_SECRET) {
      if (this.env.NODE_ENV === 'production') {
        this.logger.error('Thiếu TURNSTILE_SECRET ở production — từ chối đăng nhập trạm');
        return false;
      }
      return true;
    }
    if (!token) return false;
    try {
      const res = await fetch(SITEVERIFY, {
        method: 'POST',
        body: new URLSearchParams({ secret: this.env.TURNSTILE_SECRET, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(5_000),
      });
      const kq = (await res.json()) as { success?: boolean };
      return kq.success === true;
    } catch (e) {
      this.logger.error({ err: e }, 'Không gọi được Turnstile siteverify');
      return false;
    }
  }
}
