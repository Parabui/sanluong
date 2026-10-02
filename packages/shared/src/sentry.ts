/**
 * Làm sạch sự kiện Sentry trước khi gửi (`beforeSend`) [TDD 18]: dùng chung API, web, worker.
 * Xóa họ tên, request body, cookie, query, header (trừ vài header kỹ thuật); `user` chỉ giữ id nội bộ.
 * Giữ: route, mã lỗi, traceId, stack trace.
 */
type DuLieu = Record<string, unknown>;
interface SuKien {
  request?: { url?: string; data?: unknown; cookies?: unknown; query_string?: unknown; headers?: Record<string, string>; env?: unknown };
  user?: DuLieu;
  extra?: DuLieu;
  contexts?: DuLieu;
  breadcrumbs?: { category?: string; message?: string; data?: DuLieu }[];
}

const HEADER_GIU = new Set(['x-trace-id', 'x-vsn-client', 'user-agent', 'content-type']);
/** Khóa có thể chứa thông tin cá nhân / bí mật */
const KHOA_NHAY_CAM = /^(ho_?ten|hoTen|ten|maNV|ma_nv|matKhau|mat_khau|password|token|cookie|lyDo|ly_do|email|sdt|phone)$/i;

function boUrl(url?: string): string | undefined {
  return url?.split('?')[0];
}

function lamSachDoiTuong(o: unknown, sau = 0): unknown {
  if (!o || typeof o !== 'object' || sau > 5) return o;
  if (Array.isArray(o)) return o.map((x) => lamSachDoiTuong(x, sau + 1));
  const kq: DuLieu = {};
  for (const [k, v] of Object.entries(o as DuLieu)) kq[k] = KHOA_NHAY_CAM.test(k) ? '[đã xóa]' : lamSachDoiTuong(v, sau + 1);
  return kq;
}

export function lamSachSuKienSentry<E extends SuKien>(e: E): E {
  if (e.request) {
    delete e.request.data;
    delete e.request.cookies;
    delete e.request.query_string;
    delete e.request.env;
    e.request.url = boUrl(e.request.url);
    if (e.request.headers) {
      e.request.headers = Object.fromEntries(Object.entries(e.request.headers).filter(([k]) => HEADER_GIU.has(k.toLowerCase())));
    }
  }
  if (e.user) e.user = e.user['id'] ? { id: e.user['id'] } : {};
  if (e.extra) e.extra = lamSachDoiTuong(e.extra) as DuLieu;
  if (e.contexts) e.contexts = lamSachDoiTuong(e.contexts) as DuLieu;
  if (e.breadcrumbs) {
    e.breadcrumbs = e.breadcrumbs.map((b) => ({
      ...b,
      ...(b.data ? { data: lamSachDoiTuong({ ...b.data, url: typeof b.data['url'] === 'string' ? boUrl(b.data['url']) : b.data['url'] }) as DuLieu } : {}),
    }));
  }
  return e;
}
