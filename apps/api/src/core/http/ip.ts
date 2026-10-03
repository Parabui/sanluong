import type { Request } from 'express';

/** Địa chỉ trong mạng nội bộ / Docker / loopback — nơi caddy đứng trước API */
function laDiaChiNoiBo(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/, '');
  return (
    v4 === '127.0.0.1' ||
    ip === '::1' ||
    /^10\./.test(v4) ||
    /^192\.168\./.test(v4) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v4)
  );
}

/**
 * IP thật của người dùng [TDD 9.4]: `CF-Connecting-IP` → `X-Forwarded-For`,
 * CHỈ tin header khi kết nối đến từ mạng nội bộ (caddy/cloudflared). Ngược lại dùng địa chỉ socket.
 */
export function layIp(req: Request): string {
  const socket = req.socket.remoteAddress ?? '';
  if (laDiaChiNoiBo(socket)) {
    const cf = req.header('cf-connecting-ip');
    if (cf) return cf.trim();
    const xff = req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (xff) return xff;
  }
  return socket.replace(/^::ffff:/, '');
}
