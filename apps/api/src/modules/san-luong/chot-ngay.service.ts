import { Injectable } from '@nestjs/common';
import { congNgay, daQuaGioMoChot, dinhDangGio, dinhDangNgay, homNay, type NgayLamViec, type PhamVi, type zNgayChuaChot } from '@vsn/shared';
import type { z } from 'zod';
import { AuditService } from '../../core/audit/audit.service.js';
import { CauHinhService } from '../../core/cau-hinh/cau-hinh.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { khoaChuyenNgay } from '../../core/prisma/khoa.js';
import { ngayDb, tuNgayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { PhamViService } from '../../core/quyen/pham-vi.service.js';
import { BangSanLuongService } from './bang-san-luong.service.js';

/** "Còn X ngày chưa chốt": xét các ngày có sản lượng trong 31 ngày gần nhất */
const SO_NGAY_XET_CHUA_CHOT = 31;

/**
 * Chốt ngày (chuyền × ngày) · F10 [TDD 8.4] [R 5.9] [D26]:
 * chỉ từ Giờ mở chốt của ngày D+1 · khóa ĐỘC QUYỀN (CN, chuyền, ngày) → chờ mọi lần Lưu đang giữ khóa chia sẻ xong
 * · còn ô chưa có số / ô ⚠ / giờ chờ duyệt → BẮT BUỘC xác nhận · không có Bỏ chốt.
 * Phiên trạm của ngày đã chốt không cần job: lần Lưu kế tiếp tự bị từ chối NGAY_DA_CHOT.
 */
@Injectable()
export class ChotNgayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
    private readonly cauHinh: CauHinhService,
    private readonly phamVi: PhamViService,
    private readonly bang: BangSanLuongService,
  ) {}

  async chot(pv: PhamVi, dto: { chuyenId: string; ngay: NgayLamViec; xacNhan: boolean }): Promise<{ boi: string; luc: string }> {
    await this.phamVi.kiemTraChuyen(pv, dto.chuyenId);
    const { luc: moChot, gio } = await this.bang.moChotTu(dto.ngay);
    if (!daQuaGioMoChot(dto.ngay, this.clock.now(), gio)) {
      throw new LoiNghiepVu('CHUA_TOI_GIO_MO_CHOT', { message: `Chốt được từ ${gio} ngày ${dinhDangNgay(homNay(moChot))}.` });
    }
    const taiKhoanId = this.audit.nguCanh().nguoiThucHienId;
    if (!taiKhoanId) throw new LoiNghiepVu('CHUA_DANG_NHAP');

    return this.audit.giaoDich(async (tx) => {
      await khoaChuyenNgay(tx, dto.chuyenId, dto.ngay, 'DOC_QUYEN');
      const da = await tx.chotNgay.findUnique({
        where: { chuyenId_ngayLamViec: { chuyenId: dto.chuyenId, ngayLamViec: ngayDb(dto.ngay) } },
        include: { chotBoi: { select: { hoTen: true } } },
      });
      if (da) {
        throw new LoiNghiepVu('DA_DUOC_CHOT', {
          message: `Ngày đã được ${da.chotBoi.hoTen} chốt lúc ${dinhDangGio(da.chotLuc)} ${dinhDangNgay(homNay(da.chotLuc)).slice(0, 5)}.`,
          chiTiet: { boi: da.chotBoi.hoTen, luc: da.chotLuc.toISOString() },
        });
      }
      const canhBao = await this.bang.canhBaoChot(tx, dto.chuyenId, dto.ngay);
      const coCanhBao = canhBao.oChuaCoSo.length > 0 || canhBao.oCanhBao > 0 || canhBao.yeuCauGioChoDuyet > 0;
      if (coCanhBao && !dto.xacNhan) {
        throw new LoiNghiepVu('CAN_XAC_NHAN', {
          message: canhBao.oChuaCoSo.length ? `Còn ${canhBao.oChuaCoSo.length} ô chưa có số — xác nhận để vẫn chốt.` : 'Còn mục chưa xử lý — xác nhận để vẫn chốt.',
          chiTiet: canhBao,
        });
      }
      const now = this.clock.now();
      const c = await tx.chotNgay.create({
        data: { chuyenId: dto.chuyenId, ngayLamViec: ngayDb(dto.ngay), chotBoiId: taiKhoanId, chotLuc: now, createdAt: now },
        include: { chotBoi: { select: { hoTen: true } } },
      });
      await this.audit.ghi(tx, {
        hanhDong: 'CHOT_NGAY', doiTuong: 'chuyen', doiTuongId: dto.chuyenId,
        moi: { ngay: dto.ngay, ...(coCanhBao ? { canhBao: { oChuaCoSo: canhBao.oChuaCoSo.length, oCanhBao: canhBao.oCanhBao, yeuCauGioChoDuyet: canhBao.yeuCauGioChoDuyet } } : {}) },
      });
      return { boi: c.chotBoi.hoTen, luc: c.chotLuc.toISOString() };
    });
  }

  /** Ngày có sản lượng, đã qua giờ mở chốt mà chưa chốt — chuyền trong phạm vi [F10 "Còn X ngày chưa chốt"] */
  async chuaChot(pv: PhamVi): Promise<z.infer<typeof zNgayChuaChot>[]> {
    const ids = await this.phamVi.chuyenIds(pv);
    const homNayVN = this.clock.homNay();
    const ds = await this.prisma.$queryRaw<{ chuyen_id: string; ma: string; ngay: Date }[]>`
      SELECT DISTINCT s.chuyen_tram_snapshot AS chuyen_id, c.ma, s.ngay_lam_viec AS ngay
      FROM san_luong s JOIN chuyen c ON c.id = s.chuyen_tram_snapshot
      WHERE s.ngay_lam_viec >= ${ngayDb(congNgay(homNayVN, -SO_NGAY_XET_CHUA_CHOT))} AND s.ngay_lam_viec < ${ngayDb(homNayVN)}
        AND (${ids === null} OR s.chuyen_tram_snapshot = ANY(${ids ?? []}::uuid[]))
        AND NOT EXISTS (SELECT 1 FROM chot_ngay k WHERE k.chuyen_id = s.chuyen_tram_snapshot AND k.ngay_lam_viec = s.ngay_lam_viec)
      ORDER BY s.ngay_lam_viec, c.ma`;
    const gio = await this.cauHinh.doc('gioMoChotNgay');
    const now = this.clock.now();
    return ds.map((d) => ({ chuyenId: d.chuyen_id, maChuyen: d.ma, ngay: tuNgayDb(d.ngay) })).filter((d) => daQuaGioMoChot(d.ngay, now, gio));
  }
}
