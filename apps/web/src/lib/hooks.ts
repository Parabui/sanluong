import { useEffect, useState, useSyncExternalStore } from 'react';

/** Giá trị trễ `ms` mili-giây — dùng cho ô tìm kiếm gọi API */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Media query → boolean (chép từ ui-demo/src/lib/hooks.ts) */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => matchMedia(query).matches,
  );
}

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
