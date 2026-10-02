import { describe, expect, it } from 'vitest';
import { dinhDangSoGio, LOI_SO_GIO, zSoGio } from './schema/gio-lam.js';

describe('Số giờ [F6]', () => {
  it('nhận số thập phân, dấu phẩy hoặc chấm', () => {
    expect(zSoGio.parse('9,5')).toBe(9.5);
    expect(zSoGio.parse('10.5')).toBe(10.5);
    expect(zSoGio.parse(' 8 ')).toBe(8);
    expect(zSoGio.parse(16)).toBe(16);
    expect(zSoGio.parse('9,25')).toBe(9.25);
  });

  it('chặn giờ ≤ 0, > 16, chữ, quá 2 chữ số lẻ', () => {
    for (const v of ['0', 0, -1, '16,5', 17, 'abc', '', '9,555', 9.555, Number.NaN]) {
      const kq = zSoGio.safeParse(v);
      expect(kq.success, String(v)).toBe(false);
      expect(kq.error?.issues[0]?.message).toBe(LOI_SO_GIO);
    }
  });

  it('hiển thị kiểu Việt Nam', () => {
    expect(dinhDangSoGio(9)).toBe('9');
    expect(dinhDangSoGio(10.5)).toBe('10,5');
    expect(dinhDangSoGio(9.25)).toBe('9,25');
    expect(dinhDangSoGio(null)).toBe('—');
  });
});
