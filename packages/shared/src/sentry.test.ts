import { describe, expect, it } from 'vitest';
import { lamSachSuKienSentry } from './sentry.js';

describe('Làm sạch sự kiện Sentry [TDD 18]', () => {
  it('xóa body, cookie, query, header lạ, họ tên; user chỉ giữ id; giữ route và mã lỗi', () => {
    const e = lamSachSuKienSentry({
      request: {
        url: '/api/bao-cao/cong-nhan?q=Nguyen%20Thi%20Lan', data: { matKhau: 'x' }, cookies: { vsn_sid: 'abc' }, query_string: 'q=Lan',
        headers: { Cookie: 'vsn_sid=abc', 'X-Trace-Id': 't1', Authorization: 'Bearer x' },
      },
      user: { id: 'u1', username: 'tt.binh', email: 'a@b.c' },
      extra: { code: 'LOI_HE_THONG', nhanVien: { hoTen: 'Nguyễn Thị Lan', maNV: 'NV1', id: 'n1' } },
      breadcrumbs: [{ category: 'fetch', data: { url: '/api/x?ten=Lan', status_code: 500 } }],
    });
    expect(e.request).toEqual({ url: '/api/bao-cao/cong-nhan', headers: { 'X-Trace-Id': 't1' } });
    expect(e.user).toEqual({ id: 'u1' });
    expect(e.extra).toEqual({ code: 'LOI_HE_THONG', nhanVien: { hoTen: '[đã xóa]', maNV: '[đã xóa]', id: 'n1' } });
    expect(e.breadcrumbs?.[0]?.data).toEqual({ url: '/api/x', status_code: 500 });
  });
});
