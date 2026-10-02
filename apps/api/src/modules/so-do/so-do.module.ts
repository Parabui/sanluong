import { Module } from '@nestjs/common';
import { MaHangModule } from '../ma-hang/ma-hang.module.js';
import { SoDoController } from './so-do.controller.js';
import { SoDoService } from './so-do.service.js';

@Module({ imports: [MaHangModule], controllers: [SoDoController], providers: [SoDoService], exports: [SoDoService] })
export class SoDoModule {}
