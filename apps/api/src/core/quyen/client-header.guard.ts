import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { HEADER_CLIENT } from '@vsn/shared';
import type { Request } from 'express';
import { LoiNghiepVu } from '../loi/loi-nghiep-vu.js';

const PHUONG_THUC_GHI = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CLIENT_HOP_LE = new Set(['worker', 'web']);

/** Chống CSRF [D6] [TDD 9.3]: mọi request ghi bắt buộc có header X-VSN-Client */
@Injectable()
export class ClientHeaderGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!PHUONG_THUC_GHI.has(req.method)) return true;
    if (CLIENT_HOP_LE.has(req.header(HEADER_CLIENT) ?? '')) return true;
    throw new LoiNghiepVu('THIEU_HEADER_CLIENT');
  }
}
