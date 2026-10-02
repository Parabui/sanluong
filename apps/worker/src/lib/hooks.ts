import { useSyncExternalStore } from 'react';

/** Trạng thái mạng của trình duyệt */
export function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      addEventListener('online', cb);
      addEventListener('offline', cb);
      return () => {
        removeEventListener('online', cb);
        removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine,
  );
}

/** localStorage có bọc try/catch (Safari chế độ riêng tư / bị chặn storage) */
export const kho = {
  doc(khoa: string): string | null {
    try {
      return localStorage.getItem(khoa);
    } catch {
      return null;
    }
  },
  ghi(khoa: string, giaTri: string | null): void {
    try {
      if (giaTri == null) localStorage.removeItem(khoa);
      else localStorage.setItem(khoa, giaTri);
    } catch {
      /* bỏ qua */
    }
  },
};

/**
 * Bộ đếm thứ tự gói tin của thiết bị [D16]: khởi tạo bằng Date.now(), mỗi lần Lưu +1.
 * ITP Safari có thể xóa localStorage — khởi tạo lại bằng Date.now() vẫn lớn hơn giá trị cũ nên không lỗi.
 */
export function thuTuTiepTheo(): number {
  const cu = Number(kho.doc('vsn-thu-tu') ?? 0);
  const moi = Math.max(cu + 1, Date.now());
  kho.ghi('vsn-thu-tu', String(moi));
  return moi;
}

/** crypto.randomUUID chỉ có từ Safari 15.4 → tự sinh UUID v4 cho iOS 15.0–15.3 [D14] */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Mở trong webview Zalo / Facebook → hướng dẫn mở bằng Chrome/Safari (không chặn cứng) [D21] */
export function laWebview(): { la: boolean; android: boolean } {
  const ua = navigator.userAgent;
  return { la: /Zalo|FBAN|FBAV/i.test(ua), android: /Android/i.test(ua) };
}
