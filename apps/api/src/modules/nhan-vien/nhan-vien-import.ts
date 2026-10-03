/**
 * Import nhân viên từ Excel của HR · F2 — khung chung ở modules/import.
 * Edge case PRD F2: thiếu cột → từ chối cả file · thiếu mã/họ tên/chuyền → dòng lỗi · trùng mã trong file (sau chuẩn hóa)
 * → cả hai dòng lỗi · ô Mã NV kiểu số → cảnh báo (vẫn ghi nếu xác nhận) · chuyền không tồn tại → dòng lỗi ·
 * mã NV đã có → cập nhật, không tạo trùng.
 */
import { Injectable } from '@nestjs/common';
import { COT_IMPORT_NHAN_VIEN, type DongBaoCao, type KetQuaImport, zBacTayNghe, zHoTen, zMaNV } from '@vsn/shared';
import ExcelJS from 'exceljs';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';
import { PrismaService, type Tx } from '../../core/prisma/prisma.service.js';
import type { BoXuLyImport, KetQuaPhanTich } from '../import/bo-xu-ly.js';
import { chuanHoaTieuDe, type SheetXlsx } from '../import/doc-xlsx.js';

export interface DongNhanVien {
  dong: number;
  maNV: string;
  hoTen: string;
  chuyenId: string;
  bacTayNghe: string | null;
}

type Khoa = (typeof COT_IMPORT_NHAN_VIEN)[number]['khoa'];

@Injectable()
export class NhanVienImport implements BoXuLyImport<DongNhanVien> {
  readonly loai = 'nhan-vien' as const;
  readonly loaiDb = 'NHAN_VIEN' as const;
  readonly chucNang = 'NHAN_VIEN_QUAN_LY' as const;
  readonly tenFileMau = 'mau-import-nhan-vien.xlsx';

  constructor(private readonly prisma: PrismaService) {}

  async phanTich(sheet: SheetXlsx): Promise<KetQuaPhanTich<DongNhanVien>> {
    // ── Cột ──
    const viTri = new Map<Khoa, number>();
    const tieuDe = sheet.tieuDe.map(chuanHoaTieuDe);
    for (const c of COT_IMPORT_NHAN_VIEN) {
      const i = tieuDe.indexOf(chuanHoaTieuDe(c.tieuDe));
      if (i >= 0) viTri.set(c.khoa, i);
    }
    const thieu = COT_IMPORT_NHAN_VIEN.filter((c) => c.batBuoc && !viTri.has(c.khoa)).map((c) => c.tieuDe);
    if (thieu.length) {
      throw new LoiNghiepVu('FILE_SAI_MAU', { message: `File sai mẫu — thiếu cột: ${thieu.join(', ')}.`, chiTiet: { thieu } });
    }
    const o = (d: SheetXlsx['dong'][number], k: Khoa) => (viTri.has(k) ? d.o[viTri.get(k)!] : undefined);

    const chuyen = new Map(
      (await this.prisma.chuyen.findMany({ select: { id: true, ma: true, trangThai: true } })).map((c) => [c.ma, c]),
    );

    // ── Từng dòng ──
    const dsLoi: DongBaoCao[] = [];
    const dsCanhBao: DongBaoCao[] = [];
    const ung: DongNhanVien[] = [];
    for (const d of sheet.dong) {
      const ma = o(d, 'maNV');
      const loi: string[] = [];
      const pMa = zMaNV.safeParse(ma?.chu ?? '');
      if (!pMa.success) loi.push(ma?.chu ? (pMa.error.issues[0]?.message ?? 'Mã NV không hợp lệ') : 'Thiếu Mã NV');
      const pTen = zHoTen.safeParse(o(d, 'hoTen')?.chu ?? '');
      if (!pTen.success) loi.push(o(d, 'hoTen')?.chu ? (pTen.error.issues[0]?.message ?? 'Họ tên không hợp lệ') : 'Thiếu Họ tên');
      const pBac = zBacTayNghe.safeParse(o(d, 'bacTayNghe')?.chu ?? '');
      if (!pBac.success) loi.push(pBac.error.issues[0]?.message ?? 'Bậc tay nghề không hợp lệ');

      const maChuyen = o(d, 'maChuyen')?.chu?.trim().toUpperCase();
      const c = maChuyen ? chuyen.get(maChuyen) : undefined;
      if (!maChuyen) loi.push('Thiếu Chuyền/Nhóm');
      else if (!c) loi.push(`Chuyền/Nhóm ${maChuyen} không tồn tại`);
      else if (c.trangThai !== 'HOAT_DONG') loi.push(`Chuyền/Nhóm ${maChuyen} đã ngưng`);

      if (loi.length) {
        dsLoi.push({ dong: [d.so], lyDo: loi.join(' · ') });
        continue;
      }
      if (ma?.laSo) dsCanhBao.push({ dong: [d.so], lyDo: 'Mã NV đang ở dạng số — kiểm tra số 0 đầu' });
      ung.push({ dong: d.so, maNV: pMa.data!, hoTen: pTen.data!, chuyenId: c!.id, bacTayNghe: pBac.data ?? null });
    }

    // ── Trùng mã trong file (sau chuẩn hóa) → cả các dòng đều lỗi ──
    const theoMa = new Map<string, DongNhanVien[]>();
    for (const u of ung) theoMa.set(u.maNV, [...(theoMa.get(u.maNV) ?? []), u]);
    const hopLe: DongNhanVien[] = [];
    for (const [ma, ds] of theoMa) {
      if (ds.length > 1) dsLoi.push({ dong: ds.map((x) => x.dong), lyDo: `Trùng mã ${ma} trong file (sau chuẩn hóa)` });
      else hopLe.push(ds[0]!);
    }
    const trung = new Set(ung.filter((u) => theoMa.get(u.maNV)!.length > 1).map((u) => u.dong));

    // ── Thêm mới / cập nhật / không đổi ──
    const daCo = new Map(
      (await this.prisma.nhanVien.findMany({
        where: { maNV: { in: hopLe.map((h) => h.maNV) } },
        select: { maNV: true, hoTen: true, chuyenId: true, bacTayNghe: true },
      })).map((n) => [n.maNV, n]),
    );
    let them = 0;
    let capNhat = 0;
    let khongDoi = 0;
    for (const h of hopLe) {
      const cu = daCo.get(h.maNV);
      if (!cu) them++;
      else if (cu.hoTen !== h.hoTen || cu.chuyenId !== h.chuyenId || cu.bacTayNghe !== h.bacTayNghe) capNhat++;
      else khongDoi++;
    }

    dsLoi.sort((a, b) => a.dong[0]! - b.dong[0]!);
    return {
      tongDong: sheet.dong.length,
      them,
      capNhat,
      khongDoi,
      dsLoi,
      dsCanhBao: dsCanhBao.filter((c) => !trung.has(c.dong[0]!)),
      soDongLoi: sheet.dong.length - hopLe.length,
      hopLe,
    };
  }

  /** 1 câu upsert cho cả file (600 dòng < 10 s — PRD F2). Chuyền ngưng kể từ lúc xem trước → bỏ qua dòng đó */
  async ghi(tx: Tx, hopLe: DongNhanVien[]): Promise<KetQuaImport> {
    if (!hopLe.length) return { them: 0, capNhat: 0, boQua: 0 };
    const kq = await tx.$queryRaw<{ them: boolean }[]>`
      WITH du_lieu AS (
        SELECT * FROM unnest(${hopLe.map((h) => h.maNV)}::text[], ${hopLe.map((h) => h.hoTen)}::text[],
                             ${hopLe.map((h) => h.chuyenId)}::uuid[], ${hopLe.map((h) => h.bacTayNghe)}::text[])
          AS t(ma_nv, ho_ten, chuyen_id, bac_tay_nghe)
      )
      INSERT INTO nhan_vien (ma_nv, ho_ten, chuyen_id, bac_tay_nghe)
      SELECT d.ma_nv, d.ho_ten, d.chuyen_id, d.bac_tay_nghe
      FROM du_lieu d JOIN chuyen c ON c.id = d.chuyen_id AND c.trang_thai = 'HOAT_DONG'
      ON CONFLICT (ma_nv) DO UPDATE
        SET ho_ten = EXCLUDED.ho_ten, chuyen_id = EXCLUDED.chuyen_id, bac_tay_nghe = EXCLUDED.bac_tay_nghe,
            version = nhan_vien.version + 1
        WHERE (nhan_vien.ho_ten, nhan_vien.chuyen_id, nhan_vien.bac_tay_nghe)
              IS DISTINCT FROM (EXCLUDED.ho_ten, EXCLUDED.chuyen_id, EXCLUDED.bac_tay_nghe)
      RETURNING (xmax = 0) AS them`;
    const them = kq.filter((r) => r.them).length;
    return { them, capNhat: kq.length - them, boQua: hopLe.length - kq.length };
  }

  async taoFileMau(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('NhanVien');
    ws.columns = COT_IMPORT_NHAN_VIEN.map((c) => ({ header: c.tieuDe, key: c.khoa, width: c.khoa === 'hoTen' ? 32 : 16 }));
    ws.getRow(1).font = { bold: true };
    ws.getColumn(1).numFmt = '@'; // Mã NV dạng Text — giữ số 0 đầu [R 3.4]
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    const hd = wb.addWorksheet('HuongDan');
    for (const dong of [
      ['Hướng dẫn import nhân viên'],
      ['• Điền từ dòng 2 của sheet đầu tiên. Không đổi tên cột.'],
      ['• Mã NV, Họ tên, Chuyền/Nhóm bắt buộc. Bậc tay nghề không bắt buộc.'],
      ['• Cột Mã NV đã định dạng Text để giữ số 0 đầu. Mã NV tự trim + viết hoa.'],
      ['• Chuyền/Nhóm ghi MÃ chuyền (ví dụ C05), phải có sẵn trong danh mục.'],
      ['• Mã NV đã có trong hệ thống → cập nhật; chưa có → thêm mới. Tối đa 5.000 dòng / file.'],
    ]) hd.addRow(dong);
    hd.getColumn(1).width = 90;
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
