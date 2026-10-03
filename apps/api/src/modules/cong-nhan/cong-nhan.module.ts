import { Module } from '@nestjs/common';
import { BaoCaoModule } from '../bao-cao/bao-cao.module.js';
import { GioLamModule } from '../gio-lam/gio-lam.module.js';
import { MaHangModule } from '../ma-hang/ma-hang.module.js';
import { SanLuongModule } from '../san-luong/san-luong.module.js';
import { SoDoModule } from '../so-do/so-do.module.js';
import { CongNhanController } from './cong-nhan.controller.js';
import { FormService } from './form.service.js';
import { GioiHanSaiService } from './gioi-han-sai.service.js';
import { PhienTramService } from './phien-tram.service.js';
import { TurnstileService } from './turnstile.service.js';

/** App công nhân (/api/cn/*) · F1, F6, F11, F12 */
@Module({
  imports: [SanLuongModule, SoDoModule, MaHangModule, GioLamModule, BaoCaoModule],
  controllers: [CongNhanController],
  providers: [PhienTramService, FormService, GioiHanSaiService, TurnstileService],
  exports: [TurnstileService],
})
export class CongNhanModule {}
