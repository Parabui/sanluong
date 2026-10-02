import { QueryClient } from '@tanstack/react-query';
import { type KhoiDong, LoiApi, taoApiClient, zKhoiDong } from '@vsn/shared';

export const api = taoApiClient('worker');

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (lan, e) => !(e instanceof LoiApi && e.status >= 400 && e.status < 500) && lan < 1,
      refetchOnWindowFocus: false,
    },
    // Ghi sản lượng KHÔNG tự retry: Thử lại do người dùng bấm, dùng lại requestId [D19]
    mutations: { retry: false },
  },
});

export const KHOA_KHOI_DONG = ['cn', 'khoi-dong'] as const;
export const layKhoiDong = ({ signal }: { signal?: AbortSignal }): Promise<KhoiDong> => api.goi('/cn/khoi-dong', { schema: zKhoiDong, signal });

/** Lỗi mạng (mất kết nối, hết 15 giây chờ) → giữ số trên form, hiện "Thử lại" [R 5.3] */
export const laLoiMang = (e: unknown) => (e instanceof LoiApi && e.code === 'LOI_MANG') || (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError'));
