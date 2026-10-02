import { describe, expect, it } from 'vitest';
import {
  daQuaGioMoChot,
  dinhDangGio,
  dinhDangNgay,
  dinhDangSo,
  docSoGio,
  homNay,
  laNgayHopLe,
  loaiNgay,
  ngayLamViecLienTruoc,
  ngayMoNhap,
  thangCua,
} from './ngay-lam-viec.js';

// Mốc: 03/10/2026 = Thứ Bảy · 04/10 = Chủ nhật · 05/10 = Thứ Hai
const vn = (iso: string) => new Date(`${iso}+07:00`);
const chuaChot = () => false;

describe('homNay [D5]', () => {
  it('06:30 sáng Thứ Hai giờ VN (UTC vẫn là Chủ nhật) → Thứ Hai', () => {
    const now = vn('2026-10-05T06:30:00');
    expect(now.toISOString()).toBe('2026-10-04T23:30:00.000Z');
    expect(homNay(now)).toBe('2026-10-05');
  });

  it('23:59 tối vẫn là ngày đó', () => {
    expect(homNay(vn('2026-10-05T23:59:59'))).toBe('2026-10-05');
  });
});

describe('loaiNgay — khớp SQL loai_ngay()', () => {
  it.each([
    ['2026-10-05', 'T2_T6'],
    ['2026-10-09', 'T2_T6'],
    ['2026-10-03', 'T7'],
    ['2026-10-04', 'CN'],
  ])('%s → %s', (ngay, loai) => {
    expect(loaiNgay(ngay)).toBe(loai);
  });
});

describe('ngayMoNhap [R 3.1] [D22]', () => {
  it('Thứ Hai 07:30: vẫn nhập được Thứ Bảy nếu chưa chốt (bỏ Chủ nhật)', () => {
    expect(ngayMoNhap(vn('2026-10-05T07:30:00'), chuaChot)).toEqual(['2026-10-05', '2026-10-03']);
  });

  it('Thứ Bảy đã chốt → Thứ Hai chỉ nhập hôm nay', () => {
    const daChot = (n: string) => n === '2026-10-03';
    expect(ngayMoNhap(vn('2026-10-05T07:30:00'), daChot)).toEqual(['2026-10-05']);
  });

  it('Lưu lúc 00:01 cho ngày hôm qua chưa chốt → được nhận', () => {
    expect(ngayMoNhap(vn('2026-10-07T00:01:00'), chuaChot)).toContain('2026-10-06');
  });

  it('ngày trước nữa → không thuộc cửa sổ nhập', () => {
    expect(ngayMoNhap(vn('2026-10-07T10:00:00'), chuaChot)).not.toContain('2026-10-05');
  });

  it('ngày làm việc liền trước của Thứ Hai là Thứ Bảy', () => {
    expect(ngayLamViecLienTruoc('2026-10-05')).toBe('2026-10-03');
  });
});

describe('daQuaGioMoChot [R 5.9]', () => {
  it('07:59 sáng hôm sau → chưa', () => {
    expect(daQuaGioMoChot('2026-10-05', vn('2026-10-06T07:59:59'))).toBe(false);
  });

  it('08:00 sáng hôm sau → rồi', () => {
    expect(daQuaGioMoChot('2026-10-05', vn('2026-10-06T08:00:00'))).toBe(true);
  });

  it('Thứ Bảy chốt vào Thứ Hai → đã qua giờ mở chốt', () => {
    expect(daQuaGioMoChot('2026-10-03', vn('2026-10-05T08:30:00'))).toBe(true);
  });

  it('giờ mở chốt cấu hình 09:30', () => {
    expect(daQuaGioMoChot('2026-10-05', vn('2026-10-06T09:00:00'), '09:30')).toBe(false);
    expect(daQuaGioMoChot('2026-10-05', vn('2026-10-06T09:30:00'), '09:30')).toBe(true);
  });

  it('cuối tháng: 31/10 → mở chốt 01/11', () => {
    expect(daQuaGioMoChot('2026-10-31', vn('2026-11-01T08:00:00'))).toBe(true);
  });
});

describe('định dạng & đọc số', () => {
  it('dinhDangSo kiểu VN', () => {
    expect(dinhDangSo(1234.5)).toBe('1.234,5');
    expect(dinhDangSo(1234567)).toBe('1.234.567');
    expect(dinhDangSo(null)).toBe('—');
  });

  it('dinhDangNgay, dinhDangGio, thangCua', () => {
    expect(dinhDangNgay('2026-10-05')).toBe('05/10/2026');
    expect(dinhDangGio('2026-10-04T23:30:00.000Z')).toBe('06:30');
    expect(thangCua('2026-10-05')).toBe('2026-10');
  });

  it('docSoGio nhận cả dấu phẩy và dấu chấm', () => {
    expect(docSoGio('9,5')).toBe(9.5);
    expect(docSoGio(' 9.5 ')).toBe(9.5);
    expect(docSoGio('8')).toBe(8);
    expect(docSoGio('abc')).toBeNull();
    expect(docSoGio('9,5,1')).toBeNull();
  });

  it('laNgayHopLe', () => {
    expect(laNgayHopLe('2026-02-28')).toBe(true);
    expect(laNgayHopLe('2026-02-30')).toBe(false);
    expect(laNgayHopLe('2026-2-3')).toBe(false);
  });
});
