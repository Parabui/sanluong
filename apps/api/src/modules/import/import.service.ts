import { Inject, Injectable } from '@nestjs/common';
import {
  IMPORT_HET_HAN_PHUT,
  type KetQuaImport,
  type LoaiImport,
  type XacNhanImport,
  type XemTruocImport,
  zXacNhanImport,
} from '@vsn/shared';
import { AuditService } from '../../core/audit/audit.service.js';
import { ClockService } from '../../core/clock/clock.service.js';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import type { TaiKhoanPhien } from '../../core/ngu-canh.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { QuyenService } from '../../core/quyen/quyen.service.js';
import { BO_XU_LY_IMPORT, type BoXuLyImport } from './bo-xu-ly.js';
import { docSheetDau } from './doc-xlsx.js';
import { kiemTraFileXlsx } from './kiem-tra-file.js';

/** Danh sách lỗi/cảnh báo trả về giao diện: tối đa 500 mục (số đếm vẫn đầy đủ) */
const TOI_DA_MUC_BAO_CAO = 500;

interface DuLieuTam {
  loai: LoaiImport;
  tenFile: string;
  soCanhBao: number;
  dsCanhBao: XemTruocImport['dsCanhBao'];
  hopLe: unknown[];
}

/**
 * Khung import Excel 2 bước [TDD 6.1 ImportTam, 7.3]:
 *  1. xem trước: kiểm tra file → đọc stream → bộ xử lý phân tích → lưu ImportTam (hết hạn 30 phút) → trả tóm tắt
 *  2. xác nhận: chỉ người tạo, còn hạn, đã xác nhận cảnh báo → ghi trong 1 transaction + 1 dòng audit → xóa ImportTam
 */
@Injectable()
export class ImportService {
  private readonly boXuLy: Map<LoaiImport, BoXuLyImport>;

  constructor(
    @Inject(BO_XU_LY_IMPORT) dsBoXuLy: BoXuLyImport[],
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly quyen: QuyenService,
    private readonly clock: ClockService,
  ) {
    this.boXuLy = new Map(dsBoXuLy.map((b) => [b.loai, b]));
  }

  private async layBoXuLy(loai: LoaiImport, tk: TaiKhoanPhien): Promise<BoXuLyImport> {
    const b = this.boXuLy.get(loai);
    if (!b) throw new LoiNghiepVu('KHONG_TIM_THAY');
    if (!(await this.quyen.coMotTrong(tk.vaiTro, [b.chucNang]))) {
      await this.audit.ghiTuChoi('CHUC_NANG');
      throw new LoiNghiepVu('KHONG_CO_QUYEN');
    }
    return b;
  }

  async xemTruoc(loai: LoaiImport, file: { tenFile: string; buf: Buffer }, tk: TaiKhoanPhien): Promise<XemTruocImport> {
    const b = await this.layBoXuLy(loai, tk);
    kiemTraFileXlsx(file.tenFile, file.buf);
    const pt = await b.phanTich(await docSheetDau(file.buf));

    const now = this.clock.now();
    const hetHanLuc = new Date(now.getTime() + IMPORT_HET_HAN_PHUT * 60_000);
    await this.prisma.importTam.deleteMany({ where: { hetHanLuc: { lt: now } } }); // dọn bản hết hạn (job 03:00 làm phần còn lại)
    const duLieu: DuLieuTam = { loai, tenFile: file.tenFile, soCanhBao: pt.dsCanhBao.length, dsCanhBao: pt.dsCanhBao, hopLe: pt.hopLe };
    const tam = await this.prisma.importTam.create({
      data: { loai: b.loaiDb, nguoiTaoId: tk.id, duLieu: JSON.parse(JSON.stringify(duLieu)) as object, hetHanLuc },
    });

    return {
      importId: tam.id,
      tenFile: file.tenFile,
      tongDong: pt.tongDong,
      them: pt.them,
      capNhat: pt.capNhat,
      khongDoi: pt.khongDoi,
      loi: pt.soDongLoi,
      canhBao: pt.dsCanhBao.length,
      dsLoi: pt.dsLoi.slice(0, TOI_DA_MUC_BAO_CAO),
      dsCanhBao: pt.dsCanhBao.slice(0, TOI_DA_MUC_BAO_CAO),
      hetHanLuc: hetHanLuc.toISOString(),
    };
  }

  async xacNhan(importId: string, dauVao: XacNhanImport, tk: TaiKhoanPhien): Promise<KetQuaImport> {
    const dto = zXacNhanImport.parse(dauVao);
    const tam = await this.prisma.importTam.findUnique({ where: { id: importId } });
    // Bản xem trước của người khác → coi như không tồn tại
    if (!tam || tam.nguoiTaoId !== tk.id) throw new LoiNghiepVu('KHONG_TIM_THAY');
    if (tam.hetHanLuc <= this.clock.now()) {
      await this.prisma.importTam.deleteMany({ where: { id: importId } });
      throw new LoiNghiepVu('IMPORT_HET_HAN');
    }
    const duLieu = tam.duLieu as unknown as DuLieuTam;
    const b = await this.layBoXuLy(duLieu.loai, tk);
    if (duLieu.soCanhBao > 0 && !dto.xacNhanCanhBao) {
      throw new LoiNghiepVu('CAN_XAC_NHAN', {
        message: `Có ${duLieu.soCanhBao} dòng cảnh báo — xác nhận để vẫn ghi các dòng này.`,
        chiTiet: {
          canhBao: 'Các dòng sau có cảnh báo:',
          danhSach: duLieu.dsCanhBao.slice(0, 50).map((c) => `Dòng ${c.dong.join(', ')}: ${c.lyDo}`),
        },
      });
    }

    return this.audit.giaoDich(async (tx) => {
      // Xóa trước (khóa dòng) → 2 lần bấm Xác nhận đồng thời chỉ 1 lần ghi
      const { count } = await tx.importTam.deleteMany({ where: { id: importId } });
      if (!count) throw new LoiNghiepVu('KHONG_TIM_THAY');
      const kq = await b.ghi(tx, duLieu.hopLe);
      await this.audit.ghi(tx, {
        hanhDong: `IMPORT_${b.loaiDb}`,
        doiTuong: 'import',
        doiTuongId: importId,
        moi: { tenFile: duLieu.tenFile, ...kq, soCanhBao: duLieu.soCanhBao },
      });
      return kq;
    });
  }

  async fileMau(loai: LoaiImport, tk: TaiKhoanPhien): Promise<{ ten: string; buf: Buffer }> {
    const b = await this.layBoXuLy(loai, tk);
    return { ten: b.tenFileMau, buf: await b.taoFileMau() };
  }
}
