import { describe, expect, it } from 'vitest';
import { tenVietTat, tramIdTuQr } from './schema/cong-nhan.js';

describe('Tiện ích app công nhân', () => {
  it('[D23] tên viết tắt không lộ họ tên đầy đủ', () => {
    expect(tenVietTat('Nguyễn Thị Lan')).toBe('Ng. T. Lan');
    expect(tenVietTat('Trần Văn Hùng')).toBe('Tr. V. Hùng');
    expect(tenVietTat('Lê Thị Hoa')).toBe('L. T. Hoa');
    expect(tenVietTat('Hoa')).toBe('Hoa');
  });

  it('[F12] QR chứa UUID trần hoặc URL đăng nhập trạm', () => {
    const id = '018f3a2b-1c2d-7e3f-8a9b-0c1d2e3f4a5b';
    expect(tramIdTuQr(id)).toBe(id);
    expect(tramIdTuQr(`https://sanluong.vsn-dn.com/dang-nhap/${id.toUpperCase()}`)).toBe(id);
    expect(tramIdTuQr('https://example.com')).toBeNull();
  });
});
