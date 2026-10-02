import { QueryCache, QueryClient } from '@tanstack/react-query';
import { LoiApi, taoApiClient, type TaiKhoanToi, zTaiKhoanToi } from '@vsn/shared';

export const api = taoApiClient('web');

/** Gọi khi API trả 401 (phiên hết hạn / bị thu hồi) — main.tsx gắn hàm chuyển về trang đăng nhập */
let khiHetPhien: () => void = () => {};
export const datKhiHetPhien = (fn: () => void) => {
  khiHetPhien = fn;
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (e, query) => {
      if (e instanceof LoiApi && e.status === 401 && query.queryKey[0] !== KHOA_TOI[0]) khiHetPhien();
    },
  }),
  defaultOptions: {
    queries: {
      retry: (lan, e) => !(e instanceof LoiApi && e.status >= 400 && e.status < 500) && lan < 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (e) => {
        if (e instanceof LoiApi && e.status === 401) khiHetPhien();
      },
    },
  },
});

export const KHOA_TOI = ['auth', 'toi'] as const;

export const layTaiKhoanToi = ({ signal }: { signal?: AbortSignal }): Promise<TaiKhoanToi> =>
  api.goi('/auth/toi', { schema: zTaiKhoanToi, signal });

/** Thông báo lỗi tiếng Việt từ API (message do server trả, lấy từ @vsn/shared/loi) */
export const thongBaoLoi = (e: unknown) => (e instanceof Error ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.');
