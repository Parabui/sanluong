import { describe, expect, it } from 'vitest';
import { docMoiTruong } from './moi-truong.js';

const CO_BAN = { DATABASE_URL: 'postgresql://x' };

describe('docMoiTruong', () => {
  it('COOKIE_SECURE mặc định "true"; dev/test được tắt cho E2E trên http://localhost', () => {
    expect(docMoiTruong({ ...CO_BAN }).COOKIE_SECURE).toBe('true');
    expect(docMoiTruong({ ...CO_BAN, NODE_ENV: 'development', COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe('false');
  });

  it('production từ chối COOKIE_SECURE=false (không khởi động)', () => {
    expect(() => docMoiTruong({ ...CO_BAN, NODE_ENV: 'production', COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
  });
});
