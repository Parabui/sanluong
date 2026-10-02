/**
 * Xuất Excel báo cáo · F5 [TDD 13.2]: `ExcelJS.stream.xlsx.WorkbookWriter` ghi thẳng vào response;
 * số `#,##0` (Excel tự hiển thị theo locale máy người dùng); dòng cuối = TỔNG (cùng số với màn hình).
 */
import type { Writable } from 'node:stream';
import { dinhDangGio, dinhDangNgay, homNay, type LoaiBaoCao, TEN_BAO_CAO, TEN_NGUON } from '@vsn/shared';
import ExcelJS from 'exceljs';
import type { DongTheoLoai, KetQua } from './bao-cao.service.js';

const SO = '#,##0';
const SO_LE = '#,##0.0';
const TT = { CHUA_CHOT: 'Chưa chốt', DA_CHOT: 'Đã chốt', DA_KHOA: 'Đã khóa' } as const;

interface Cot<T> { tieuDe: string; rong: number; dinhDang?: string; lay: (d: T) => string | number | null; tong?: string }
type CotTheoLoai = { [L in LoaiBaoCao]: Cot<DongTheoLoai[L]>[] };

const COT: CotTheoLoai = {
  'cong-nhan': [
    { tieuDe: 'Ngày', rong: 12, lay: (d) => dinhDangNgay(d.ngay) },
    { tieuDe: 'Mã NV', rong: 12, lay: (d) => d.maNV },
    { tieuDe: 'Họ tên', rong: 26, lay: (d) => d.hoTen },
    { tieuDe: 'Chuyền', rong: 10, lay: (d) => d.maChuyen },
    { tieuDe: 'Trạm', rong: 10, lay: (d) => d.tram.join(', ') },
    { tieuDe: 'Công đoạn', rong: 18, lay: (d) => d.congDoan.join(', ') },
    { tieuDe: 'Sản lượng', rong: 12, dinhDang: SO, lay: (d) => d.sanLuong, tong: 'sanLuong' },
    { tieuDe: 'Phút SMV', rong: 12, dinhDang: SO_LE, lay: (d) => d.phutSmv, tong: 'phutSmv' },
    { tieuDe: 'Giờ làm', rong: 10, dinhDang: '#,##0.00', lay: (d) => d.gioLam },
    { tieuDe: '% Hiệu suất', rong: 12, dinhDang: SO_LE, lay: (d) => d.hieuSuat, tong: 'hieuSuat' },
    { tieuDe: 'Ghi chú', rong: 30, lay: (d) => [d.hoTroTu && `Hỗ trợ từ ${d.hoTroTu}`, d.gioLam == null && 'Chưa có giờ làm', d.gioChoDuyet && 'Giờ làm chờ duyệt', d.tamTinh && 'Tạm tính'].filter(Boolean).join('; ') },
    { tieuDe: 'Trạng thái', rong: 12, lay: (d) => TT[d.trangThai] },
  ],
  'cong-doan': [
    { tieuDe: 'Chuyền', rong: 10, lay: (d) => d.maChuyen },
    { tieuDe: 'Trạm', rong: 8, lay: (d) => d.soTram },
    { tieuDe: 'Mã hàng', rong: 12, lay: (d) => d.maMaHang },
    { tieuDe: 'Mã CĐ', rong: 10, lay: (d) => d.maCongDoan },
    { tieuDe: 'Công đoạn', rong: 28, lay: (d) => d.tenCongDoan },
    { tieuDe: 'SMV (giây)', rong: 12, dinhDang: '#,##0.###', lay: (d) => d.smv },
    { tieuDe: 'Sản lượng', rong: 12, dinhDang: SO, lay: (d) => d.sanLuong, tong: 'sanLuong' },
    { tieuDe: 'Phút SMV', rong: 12, dinhDang: SO_LE, lay: (d) => d.phutSmv, tong: 'phutSmv' },
  ],
  chuyen: [
    { tieuDe: 'Chuyền', rong: 10, lay: (d) => d.maChuyen },
    { tieuDe: 'Tên chuyền', rong: 22, lay: (d) => d.tenChuyen },
    { tieuDe: 'Hoàn thành (QC)', rong: 16, dinhDang: SO, lay: (d) => d.hoanThanh, tong: 'hoanThanh' },
    { tieuDe: 'Sản lượng', rong: 12, dinhDang: SO, lay: (d) => d.sanLuong, tong: 'sanLuong' },
    { tieuDe: 'Phút SMV', rong: 12, dinhDang: SO_LE, lay: (d) => d.phutSmv, tong: 'phutSmv' },
    { tieuDe: 'Phút làm', rong: 12, dinhDang: SO_LE, lay: (d) => d.phutLam, tong: 'phutLam' },
    { tieuDe: '% Hiệu suất chuyền', rong: 18, dinhDang: SO_LE, lay: (d) => d.hieuSuat, tong: 'hieuSuat' },
    { tieuDe: 'Số NV', rong: 8, dinhDang: SO, lay: (d) => d.soNv },
    { tieuDe: 'Ghi chú', rong: 14, lay: (d) => (d.tamTinh ? 'Tạm tính' : '') },
  ],
  'ma-hang': [
    { tieuDe: 'Mã hàng', rong: 12, lay: (d) => d.ma },
    { tieuDe: 'Tên hàng', rong: 28, lay: (d) => d.ten },
    { tieuDe: 'Đã làm (kỳ)', rong: 12, dinhDang: SO, lay: (d) => d.daLamKy, tong: 'daLamKy' },
    { tieuDe: 'Đã làm (lũy kế)', rong: 14, dinhDang: SO, lay: (d) => d.daLamLuyKe },
    { tieuDe: 'Tổng đơn', rong: 12, dinhDang: SO, lay: (d) => d.soLuongDonHang },
    { tieuDe: 'Còn lại', rong: 12, dinhDang: SO, lay: (d) => d.conLai },
    { tieuDe: '% Hoàn thành', rong: 14, dinhDang: SO_LE, lay: (d) => d.phanTram },
    { tieuDe: 'Trạng thái tháng', rong: 16, lay: (d) => (d.trangThaiThang === 'KHOA' ? 'Đã khóa' : 'Chưa khóa') },
  ],
  'lich-su': [
    { tieuDe: 'Thời điểm', rong: 18, lay: (d) => `${dinhDangGio(d.luc)} ${dinhDangNgay(homNay(new Date(d.luc)))}` },
    { tieuDe: 'Người thực hiện', rong: 24, lay: (d) => d.nguoi },
    { tieuDe: 'Ngày làm việc', rong: 13, lay: (d) => dinhDangNgay(d.ngay) },
    { tieuDe: 'Chuyền', rong: 10, lay: (d) => d.maChuyen },
    { tieuDe: 'Trạm', rong: 8, lay: (d) => d.soTram },
    { tieuDe: 'Công đoạn', rong: 10, lay: (d) => d.maCongDoan },
    { tieuDe: 'Mã NV', rong: 12, lay: (d) => d.maNV },
    { tieuDe: 'Họ tên NV', rong: 24, lay: (d) => d.hoTenNV },
    { tieuDe: 'Số cũ', rong: 10, dinhDang: SO, lay: (d) => d.soCu },
    { tieuDe: 'Số mới', rong: 10, dinhDang: SO, lay: (d) => d.soMoi },
    { tieuDe: 'Nguồn', rong: 10, lay: (d) => TEN_NGUON[d.nguon] },
    { tieuDe: 'Lý do', rong: 30, lay: (d) => d.lyDo ?? '' },
  ],
};

export async function ghiExcel<L extends LoaiBaoCao>(loai: L, kq: KetQua<DongTheoLoai[L]>, khoang: { tu: string; den: string }, dich: Writable): Promise<void> {
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: dich, useStyles: true });
  // Tên sheet Excel không được chứa * ? : \ / [ ] và tối đa 31 ký tự
  const ws = wb.addWorksheet(TEN_BAO_CAO[loai].replace(/[*?:\\/[\]]/g, '-').slice(0, 31));
  const cot = COT[loai] as Cot<DongTheoLoai[L]>[];
  ws.columns = cot.map((c) => ({ header: c.tieuDe, width: c.rong, style: c.dinhDang ? { numFmt: c.dinhDang } : {} }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).commit();
  for (const d of kq.dong) ws.addRow(cot.map((c) => c.lay(d))).commit();
  // Dòng TỔNG — cùng tongCong với màn hình
  const tong = ws.addRow(cot.map((c, i) => (i === 0 ? `Tổng (${kq.tongDong} dòng)` : c.tong ? kq.tongCong[c.tong] ?? null : null)));
  tong.font = { bold: true };
  tong.commit();
  ws.commit();

  if (loai === 'ma-hang') {
    const cd = wb.addWorksheet('Theo công đoạn');
    cd.columns = [{ header: 'Mã hàng', width: 12 }, { header: 'Mã CĐ', width: 10 }, { header: 'Công đoạn', width: 28 }, { header: 'Sản lượng', width: 12, style: { numFmt: SO } }];
    cd.getRow(1).font = { bold: true };
    cd.getRow(1).commit();
    for (const m of kq.dong as DongTheoLoai['ma-hang'][]) for (const c of m.congDoan) cd.addRow([m.ma, c.ma, c.ten, c.sanLuong]).commit();
    cd.commit();
  }
  const tt = wb.addWorksheet('Thông tin');
  tt.addRow(['Báo cáo', TEN_BAO_CAO[loai]]).commit();
  tt.addRow(['Từ ngày', dinhDangNgay(khoang.tu)]).commit();
  tt.addRow(['Đến ngày', dinhDangNgay(khoang.den)]).commit();
  tt.addRow(['Số liệu', 'Số nhập cuối cùng của mỗi bản ghi; phút SMV theo SMV snapshot; % hiệu suất = phút SMV ÷ (giờ làm × 60)']).commit();
  tt.commit();
  await wb.commit();
}
