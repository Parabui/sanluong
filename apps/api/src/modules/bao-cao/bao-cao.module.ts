import { Module } from '@nestjs/common';
import { BaoCaoController } from './bao-cao.controller.js';
import { BaoCaoService } from './bao-cao.service.js';

/** Báo cáo sản lượng (F5) + nguồn số liệu "Của tôi" (F11) — dùng chung view nên F5 = F11 */
@Module({ controllers: [BaoCaoController], providers: [BaoCaoService], exports: [BaoCaoService] })
export class BaoCaoModule {}
