import { useSyncExternalStore } from 'react';

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
