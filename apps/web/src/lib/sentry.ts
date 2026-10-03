/**
 * Sentry cho Web quản lý [TDD 18]: chỉ bật khi build có VITE_SENTRY_DSN; `beforeSend` xóa họ tên / body / cookie / query.
 */
import * as Sentry from '@sentry/react';
import { lamSachSuKienSentry } from '@vsn/shared';

const DSN = import.meta.env['VITE_SENTRY_DSN'] as string | undefined;

export function khoiTaoSentry(phienBan: string): void {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    release: `web@${phienBan}`,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    beforeSend: (e) => lamSachSuKienSentry(e),
  });
}
