import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import {
  type CayTram,
  congNgay,
  type CuaToi,
  type CuaToiNgay,
  type FormNhap,
  type GioLamCuaToi,
  type KetQuaGhi,
  type KhoiDong,
  type TramQr,
  zDangNhapTram,
  zGhiSanLuong,
  zGuiYeuCauGio,
  zNgayLamViec,
  zUuid,
} from '@vsn/shared';
import type { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { createZodDto, ZodValidationPipe } from 'nestjs-zod';
import { z } from 'zod';
import { AuditService } from '../../core/audit/audit.service.js';
import type { VsnClsStore } from '../../core/ngu-canh.js';
import { tuNgayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { CongKhai, CongNhan } from '../../core/quyen/quyen.decorator.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { BaoCaoService } from '../bao-cao/bao-cao.service.js';
import { GioLamService } from '../gio-lam/gio-lam.service.js';
import { GhiSanLuongService } from '../san-luong/ghi-san-luong.service.js';
import { FormService } from './form.service.js';
import { PhienTramService } from './phien-tram.service.js';

class DangNhapTramDto extends createZodDto(zDangNhapTram) {}
class GhiSanLuongDto extends createZodDto(zGhiSanLuong) {}
class GuiYeuCauGioDto extends createZodDto(zGuiYeuCauGio) {}
class LocFormDto extends createZodDto(z.object({ tramId: zUuid, ngay: zNgayLamViec })) {}

const Id = () => Param('id', new ZodValidationPipe(zUuid));

/**
 * App công nhân [TDD 7.3] — xác thực bằng cookie thiết bị `vsn_tb`, không mật khẩu [D6].
 * Route trước đăng nhập là @CongKhai (đăng nhập trạm có Turnstile + giới hạn sai theo thiết bị [D23]).
 */
@Controller('cn')
export class CongNhanController {
  constructor(
    private readonly phien: PhienTramService,
    private readonly formService: FormService,
    private readonly ghi: GhiSanLuongService,
    private readonly gioLam: GioLamService,
    private readonly baoCao: BaoCaoService,
    private readonly audit: AuditService,
    private readonly cls: ClsService<VsnClsStore>,
    private readonly prisma: PrismaService,
  ) {}

  private get thietBiId(): string {
    return this.cls.get('thietBi')!.id;
  }

  /** Giờ server, phiên của thiết bị, thông báo chuyển phiên — KHÔNG tạo cookie [D21] */
  @Get('khoi-dong')
  @CongKhai()
  khoiDong(@Req() req: Request): Promise<KhoiDong> {
    return this.phien.khoiDong(req);
  }

  @Get('cay-tram')
  @CongKhai()
  cayTram(): Promise<CayTram> {
    return this.phien.cayTram();
  }

  /** Tra trạm theo UUID khi quét QR [F12] */
  @Get('tram/:id')
  @CongKhai()
  tram(@Param('id', new ZodValidationPipe(zUuid.catch('00000000-0000-0000-0000-000000000000'))) id: string): Promise<TramQr> {
    return this.phien.tramQr(id);
  }

  @Post('phien-tram')
  @CongKhai()
  @HttpCode(200)
  dangNhap(@Body() dto: DangNhapTramDto, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<KhoiDong> {
    return this.phien.dangNhap(dto, req, res);
  }

  @Delete('phien-tram/:id')
  @CongNhan()
  @HttpCode(204)
  dangXuat(@Id() id: string): Promise<void> {
    return this.phien.dangXuat(id, this.thietBiId);
  }

  @Get('form')
  @CongNhan()
  form(@Query() q: LocFormDto): Promise<FormNhap> {
    return this.formService.form(this.thietBiId, q.tramId, q.ngay);
  }

  @Put('san-luong')
  @CongNhan()
  ghiSanLuong(@Body() dto: GhiSanLuongDto): Promise<KetQuaGhi> {
    return this.ghi.ghiApp(dto, this.thietBiId, this.audit.nguCanh());
  }

  /** NV của thiết bị + các Ngày mở nhập (ngày có phiên trạm còn hiệu lực) [D22] */
  private async nvVaNgayMo(): Promise<{ nhanVienId: string | null; ngayMo: string[] }> {
    const phien = await this.phien.phienHieuLuc(this.prisma, this.thietBiId);
    return { nhanVienId: phien[0]?.nhanVienId ?? null, ngayMo: [...new Set(phien.map((p) => tuNgayDb(p.ngayLamViec)))] };
  }

  /** Giờ mặc định / giờ đang tính của các ngày đang mở + yêu cầu đã gửi · F6 */
  @Get('gio-lam')
  @CongNhan()
  async xemGioLam(): Promise<GioLamCuaToi> {
    const { nhanVienId, ngayMo } = await this.nvVaNgayMo();
    return this.gioLam.cuaToi(nhanVienId, ngayMo);
  }

  /** Gửi yêu cầu sửa giờ (về sớm / tăng ca) — thay thế yêu cầu đang chờ cùng ngày · F6 */
  @Post('gio-lam')
  @CongNhan()
  @HttpCode(200)
  async guiYeuCauGio(@Body() dto: GuiYeuCauGioDto): Promise<GioLamCuaToi> {
    const { nhanVienId, ngayMo } = await this.nvVaNgayMo();
    await this.gioLam.guiYeuCau(nhanVienId, ngayMo, dto.ngay, dto.soGio);
    return this.gioLam.cuaToi(nhanVienId, ngayMo);
  }

  /** NV trong phiên của thiết bị (hôm nay hoặc ngày trước chưa chốt) */
  private async nhanVienPhien() {
    const phien = await this.phien.phienHieuLuc(this.prisma, this.thietBiId);
    return phien[0]?.nhanVien ?? null;
  }

  /** Của tôi: 30 ngày gần nhất có sản lượng — chỉ dữ liệu của chính NV trong phiên · F11 */
  @Get('cua-toi')
  @CongNhan()
  async cuaToi(): Promise<CuaToi> {
    const nv = await this.nhanVienPhien();
    const homNay = this.baoCao.homNay();
    if (!nv) return { nhanVien: null, tu: homNay, den: homNay, ngay: [] };
    return { nhanVien: { maNV: nv.maNV, hoTen: nv.hoTen }, ...(await this.baoCao.cuaToi(nv.id)) };
  }

  @Get('cua-toi/:ngay')
  @CongNhan()
  async cuaToiNgay(@Param('ngay', new ZodValidationPipe(zNgayLamViec)) ngay: string): Promise<CuaToiNgay> {
    const nv = await this.nhanVienPhien();
    if (!nv) throw new LoiNghiepVu('CHUA_DANG_NHAP_TRAM');
    const homNay = this.baoCao.homNay();
    const kq = ngay <= homNay && ngay >= congNgay(homNay, -29) ? await this.baoCao.cuaToiNgay(nv.id, ngay) : null;
    if (!kq) throw new LoiNghiepVu('KHONG_TIM_THAY', { message: 'Không có sản lượng ngày này.' });
    return kq;
  }
}
