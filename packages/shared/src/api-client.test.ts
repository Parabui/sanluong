import { describe, expect, it } from 'vitest';
import { LoiApi, noiDungLoi } from './api-client.js';
import { LOI } from './loi.js';

const TRACE = '3f2a9c1e-7b4d-4e2a-9f10-5c6d7e8f9a0b';

describe('noiDungLoi', () => {
  it('lỗi hệ thống (5xx) kèm 8 ký tự đầu traceId viết hoa để người dùng đọc cho IT', () => {
    const e = new LoiApi(500, 'LOI_HE_THONG', 'Có lỗi xảy ra, vui lòng thử lại.', TRACE);
    expect(e.maTraCuu).toBe('3F2A9C1E');
    expect(noiDungLoi(e)).toBe('Có lỗi xảy ra, vui lòng thử lại. (mã lỗi 3F2A9C1E)');
  });

  it('lỗi nghiệp vụ (4xx) chỉ hiện câu tiếng Việt, không kèm mã', () => {
    const e = new LoiApi(409, 'NGAY_DA_CHOT', LOI.NGAY_DA_CHOT.message, TRACE);
    expect(e.maTraCuu).toBeUndefined();
    expect(noiDungLoi(e)).toBe(LOI.NGAY_DA_CHOT.message);
  });

  it('không phải LoiApi → message của Error, hoặc câu mặc định', () => {
    expect(noiDungLoi(new Error('Không tải được Turnstile'))).toBe('Không tải được Turnstile');
    expect(noiDungLoi('x')).toBe('Có lỗi xảy ra, vui lòng thử lại.');
    expect(noiDungLoi(undefined, 'Không tải được công đoạn')).toBe('Không tải được công đoạn');
  });
});
