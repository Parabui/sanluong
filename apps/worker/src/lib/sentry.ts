/**
 * Sentry cho app công nhân [TDD 18] — nạp LƯỜI sau khi app đã chạy để không tính vào dung lượng tải lần đầu (≤ 180 KB).
 * Chỉ bật khi build có VITE_SENTRY_DSN; `beforeSend` xóa họ tên / body / cookie / query.
 */
import { lamSachSuKienSentry } from '@vsn/shared';

const DSN = import.meta.env['VITE_SENTRY_DSN'] as string | undefined;

export function khoiTaoSentryLuoi(): void {
  if (!DSN) return;
  const nap = () =>
    void import('@sentry/react').then((Sentry) =>
      Sentry.init({ dsn: DSN, release: 'worker', environment: import.meta.env.MODE, tracesSampleRate: 0, beforeSend: (e) => lamSachSuKienSentry(e) }),
    );
  if (document.readyState === 'complete') setTimeout(nap, 1000);
  else addEventListener('load', () => setTimeout(nap, 1000), { once: true });
}
