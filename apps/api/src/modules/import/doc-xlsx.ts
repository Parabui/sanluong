/**
 * Đọc sheet ĐẦU TIÊN của file .xlsx, tối đa 5.000 dòng dữ liệu [TDD 19].
 *
 * Lệch TDD (có chủ đích): TDD ghi "WorkbookReader dạng stream". ExcelJS 4.4 WorkbookReader (1) lỗi khi
 * xl/workbook.xml nằm SAU sheet trong zip (thứ tự tùy phần mềm tạo file) và (2) khi đó ghi sheet ra FILE TẠM
 * trên đĩa — trái quy tắc "không lưu file lên đĩa". Vì vậy dùng `xlsx.load()` trong bộ nhớ; bộ nhớ vẫn bị
 * chặn trên vì kiemTraFileXlsx() đã đọc central directory và từ chối file giải nén > 50 MB TRƯỚC khi gọi hàm này.
 */
import { IMPORT_TOI_DA_DONG } from '@vsn/shared';
import ExcelJS from 'exceljs';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';

export interface O {
  /** Giá trị dạng chuỗi (đã trim); null = ô trống */
  chu: string | null;
  /** Ô đang ở kiểu SỐ (vd. Mã NV mất số 0 đầu) */
  laSo: boolean;
}

export interface DongXlsx {
  /** Số dòng trong Excel (1 = tiêu đề) */
  so: number;
  o: O[];
}

export interface SheetXlsx {
  tieuDe: string[];
  dong: DongXlsx[];
}

function sangO(v: ExcelJS.CellValue): O {
  if (v === null || v === undefined) return { chu: null, laSo: false };
  if (typeof v === 'number') return { chu: String(v), laSo: true };
  if (typeof v === 'string') return { chu: v.trim() || null, laSo: false };
  if (typeof v === 'boolean') return { chu: String(v), laSo: false };
  if (v instanceof Date) return { chu: v.toISOString(), laSo: false };
  if ('richText' in v) return sangO(v.richText.map((r) => r.text).join(''));
  if ('result' in v) return sangO((v.result ?? null) as ExcelJS.CellValue); // ô công thức → lấy kết quả
  if ('text' in v) return sangO(v.text as string); // hyperlink
  return { chu: null, laSo: false }; // ô lỗi (#N/A…)
}

/** Chuẩn hóa tiêu đề để so khớp: bỏ dấu, chữ thường, bỏ khoảng trắng / "/" / "-" */
export const chuanHoaTieuDe = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[\s/_-]+/g, '');

export async function docSheetDau(buf: Buffer): Promise<SheetXlsx> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new LoiNghiepVu('FILE_KHONG_HOP_LE', { message: 'Không đọc được file Excel — file có thể bị hỏng.', chiTiet: { lyDo: 'PARSE' } });
  }
  const ws = wb.worksheets[0];
  const kq: SheetXlsx = { tieuDe: [], dong: [] };
  if (!ws) return kq;

  ws.eachRow({ includeEmpty: false }, (row, so) => {
    const o = (row.values as ExcelJS.CellValue[]).slice(1).map(sangO); // ExcelJS đánh chỉ số cột từ 1
    if (so === 1) {
      kq.tieuDe = o.map((x) => x.chu ?? '');
      return;
    }
    if (o.every((x) => x.chu === null)) return; // bỏ dòng trống
    if (kq.dong.length >= IMPORT_TOI_DA_DONG) throw new LoiNghiepVu('FILE_QUA_NHIEU_DONG');
    kq.dong.push({ so, o });
  });
  return kq;
}
