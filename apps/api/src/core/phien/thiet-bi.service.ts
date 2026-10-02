import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { COOKIE_THIET_BI } from '@vsn/shared';
import type { CookieOptions, Request, Response } from 'express';
import { ClockService } from '../clock/clock.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { bamToken } from './phien-web.service.js';

/** Cập nhật lanCuoi tối đa 1 lần / 5 phút [TDD 9.1] */
const CHU_KY_LAN_CUOI_MS = 5 * 60_000;
const COOKIE: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/api', maxAge: 400 * 24 * 3_600_000 };

/**
 * Cookie thiết bị `vsn_tb` của app công nhân [D6] [TDD 9.1]: 32 byte ngẫu nhiên, DB chỉ giữ SHA-256.
 * CHỈ tạo khi đăng nhập trạm thành công — request ẩn danh không tạo dòng ThietBi [D21].
 * Safari, icon PWA, webview Zalo là các kho cookie riêng → server thấy là nhiều thiết bị (R 1.3 chỉ best effort).
 */
@Injectable()
export class ThietBiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  /** Thiết bị của request; không có cookie / cookie lạ → null */
  async xacThuc(req: Request): Promise<{ id: string } | null> {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[COOKIE_THIET_BI];
    if (!token) return null;
    const tb = await this.prisma.thietBi.findUnique({ where: { tokenHash: bamToken(token) }, select: { id: true, lanCuoi: true } });
    if (!tb) return null;
    const now = this.clock.now();
    if (now.getTime() - tb.lanCuoi.getTime() > CHU_KY_LAN_CUOI_MS) {
      await this.prisma.thietBi.updateMany({ where: { id: tb.id }, data: { lanCuoi: now } });
    }
    return { id: tb.id };
  }

  /** Tạo thiết bị mới trong transaction đăng nhập; cookie chỉ đặt sau khi COMMIT thành công */
  async tao(tx: Tx, req: Request): Promise<{ id: string; token: string }> {
    const token = randomBytes(32).toString('base64url');
    const now = this.clock.now();
    const tb = await tx.thietBi.create({
      data: { tokenHash: bamToken(token), userAgent: req.header('user-agent')?.slice(0, 300) ?? null, taoLuc: now, lanCuoi: now },
      select: { id: true },
    });
    return { id: tb.id, token };
  }

  datCookie(res: Response, token: string): void {
    res.cookie(COOKIE_THIET_BI, token, COOKIE);
  }
}
