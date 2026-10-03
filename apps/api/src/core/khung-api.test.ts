import 'reflect-metadata';
import { Body, Controller, Get, type INestApplication, Module, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { HEADER_CLIENT } from '@vsn/shared';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppModule } from '../app.module.js';
import { cauHinhApp } from '../cau-hinh-app.js';
import { CongKhai, Quyen } from './quyen/quyen.decorator.js';

class ThuDto extends createZodDto(z.object({ soLuong: z.number().int().min(0, 'Số lượng không được âm') })) {}

@Controller('thu')
class ThuController {
  @Post('cong-khai')
  @CongKhai()
  ghi(@Body() dto: ThuDto) {
    return dto;
  }

  @Get('can-quyen')
  @Quyen('BAO_CAO_XEM')
  xem() {
    return { ok: true };
  }
}

@Module({ controllers: [ThuController] })
class ThuModule {}

async function taoApp(...modules: unknown[]): Promise<INestApplication> {
  const ref = await Test.createTestingModule({ imports: [AppModule, ...(modules as [])] }).compile();
  const app = cauHinhApp(ref.createNestApplication<NestExpressApplication>({ logger: false }));
  await app.init();
  return app;
}

describe('Khung API', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await taoApp(ThuModule);
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health → { ok: true } kèm X-Trace-Id', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['x-trace-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('[D6] request ghi thiếu X-VSN-Client → 403 THIEU_HEADER_CLIENT, traceId khớp header', async () => {
    const res = await request(app.getHttpServer()).post('/api/thu/cong-khai').send({ soLuong: 1 }).expect(403);
    expect(res.body.code).toBe('THIEU_HEADER_CLIENT');
    expect(res.body.traceId).toBe(res.headers['x-trace-id']);
  });

  it('request ghi có X-VSN-Client → qua guard', async () => {
    await request(app.getHttpServer())
      .post('/api/thu/cong-khai')
      .set(HEADER_CLIENT, 'web')
      .send({ soLuong: 5 })
      .expect(201, { soLuong: 5 });
  });

  it('[D3] sai schema Zod → 400 DU_LIEU_KHONG_HOP_LE kèm field, message tiếng Việt', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/thu/cong-khai')
      .set(HEADER_CLIENT, 'worker')
      .send({ soLuong: -1 })
      .expect(400);
    expect(res.body).toMatchObject({ code: 'DU_LIEU_KHONG_HOP_LE', field: 'soLuong' });
    expect(res.body.chiTiet[0].message).toBe('Số lượng không được âm');
    expect(res.body.message).toBe('Số lượng không được âm');
  });

  it('[D8] route có @Quyen nhưng chưa đăng nhập → 401 CHUA_DANG_NHAP', async () => {
    const res = await request(app.getHttpServer()).get('/api/thu/can-quyen').expect(401);
    expect(res.body.code).toBe('CHUA_DANG_NHAP');
  });

  it('route không tồn tại → 404 KHONG_TIM_THAY', async () => {
    const res = await request(app.getHttpServer()).get('/api/khong-co').expect(404);
    expect(res.body.code).toBe('KHONG_TIM_THAY');
  });
});

describe('[D8] Mặc định từ chối', () => {
  @Controller('quen')
  class QuenQuyenController {
    @Get()
    xem() {
      return {};
    }
  }
  @Module({ controllers: [QuenQuyenController] })
  class QuenQuyenModule {}

  it('route thiếu @Quyen/@CongKhai → app KHÔNG khởi động được', async () => {
    await expect(taoApp(QuenQuyenModule)).rejects.toThrow('QuenQuyenController.xem');
  });
});
