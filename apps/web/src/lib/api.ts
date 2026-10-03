import { QueryCache, QueryClient } from '@tanstack/react-query';
import { HEADER_CLIENT, laMaLoi, LoiApi, noiDungLoi, taoApiClient, type TaiKhoanToi, zTaiKhoanToi } from '@vsn/shared';

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
export const thongBaoLoi = (e: unknown) => noiDungLoi(e);

/**
 * Tải file từ API (vd. Excel báo cáo): gửi kèm header X-VSN-Client [D6] nên không dùng được thẻ <a href> trực tiếp.
 * Lỗi (JSON) → ném LoiApi với message tiếng Việt từ server.
 */
export async function taiFile(duongDan: string): Promise<void> {
  const res = await fetch(`/api${duongDan}`, { credentials: 'same-origin', headers: { [HEADER_CLIENT]: 'web' } });
  if (!res.ok) {
    const loi = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new LoiApi(res.status, laMaLoi(loi.code) ? loi.code : 'LOI_HE_THONG', loi.message ?? 'Có lỗi xảy ra, vui lòng thử lại.');
  }
  const ten = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'bao-cao.xlsx';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = ten;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
