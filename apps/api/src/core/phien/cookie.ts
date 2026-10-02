/**
 * Cờ `Secure` của cookie phiên Web / thiết bị [TDD 9.1]. Production LUÔN Secure (docMoiTruong từ chối COOKIE_SECURE=false).
 * Chỉ E2E trên http://localhost mới tắt (tools/thu/chay.mjs): WebKit của Playwright bỏ cookie Secure trên http,
 * Chromium thì không — không tắt thì luồng iPhone / Safari không đăng nhập được.
 */
export const COOKIE_SECURE = process.env['NODE_ENV'] === 'production' || process.env['COOKIE_SECURE'] !== 'false';
