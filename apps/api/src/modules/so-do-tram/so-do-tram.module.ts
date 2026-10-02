import { Module } from '@nestjs/common';
import { SoDoModule } from '../so-do/so-do.module.js';
import { SoDoTramController } from './so-do-tram.controller.js';
import { SoDoTramService } from './so-do-tram.service.js';

/** Sơ đồ trạm trực tiếp + đăng xuất hộ · F17 */
@Module({ imports: [SoDoModule], controllers: [SoDoTramController], providers: [SoDoTramService] })
export class SoDoTramModule {}
