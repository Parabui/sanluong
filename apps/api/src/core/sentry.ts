/**
 * Sentry cho API [TDD 18]: chỉ bật khi có SENTRY_DSN. `beforeSend` xóa họ tên / body / cookie (lamSachSuKienSentry);
 * Sentry v11 mặc định không gửi PII; không trace hiệu năng (MVP chỉ bắt lỗi).
 */
import * as Sentry from '@sentry/node';
import { lamSachSuKienSentry } from '@vsn/shared';
import type { MoiTruong } from './moi-truong.js';

let daBat = false;

export function khoiTaoSentry(env: MoiTruong): void {
  if (!env.SENTRY_DSN || daBat) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: env.APP_VERSION,
    tracesSampleRate: 0,
    beforeSend: (e) => lamSachSuKienSentry(e),
  });
  daBat = true;
}

/** Gửi lỗi hệ thống (500) kèm traceId để tra log; không bật Sentry thì bỏ qua */
export function baoLoi(loi: unknown, ngu: { traceId: string; route?: string }): void {
  if (!daBat) return;
  Sentry.withScope((s) => {
    s.setTag('traceId', ngu.traceId);
    if (ngu.route) s.setTag('route', ngu.route);
    Sentry.captureException(loi);
  });
}

export function baoBatThuong(thongDiep: string, duLieu: Record<string, number>): void {
  if (!daBat) return;
  Sentry.captureMessage(thongDiep, { level: 'error', extra: duLieu });
}
