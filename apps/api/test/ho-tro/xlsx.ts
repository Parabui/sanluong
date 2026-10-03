/** Tạo file test cho import: .xlsx thật (ExcelJS) và zip giả khai báo dung lượng giải nén lớn (zip bomb) */
import ExcelJS from 'exceljs';

export type GiaTriO = string | number | null;

export async function taoXlsx(tieuDe: string[], dong: GiaTriO[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(tieuDe);
  for (const d of dong) ws.addRow(d);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const TIEU_DE_NV = ['Mã NV', 'Họ tên', 'Chuyền/Nhóm', 'Bậc tay nghề'];

/**
 * Zip hợp lệ về cấu trúc, 1 mục rỗng nhưng central directory KHAI BÁO dung lượng giải nén `khaiBao` byte.
 * Bộ kiểm tra phải chặn chỉ bằng cách đọc central directory, không cần giải nén.
 */
export function taoZipGia(khaiBao: number): Buffer {
  const ten = Buffer.from('xl/workbook.xml');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(0, 18); // nén
  local.writeUInt32LE(khaiBao, 22); // giải nén (khai báo)
  local.writeUInt16LE(ten.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(0, 20);
  central.writeUInt32LE(khaiBao, 24);
  central.writeUInt16LE(ten.length, 28);
  central.writeUInt32LE(0, 42); // vị trí local header

  const viTriCd = local.length + ten.length;
  const kichThuocCd = central.length + ten.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(kichThuocCd, 12);
  eocd.writeUInt32LE(viTriCd, 16);
  return Buffer.concat([local, ten, central, ten, eocd]);
}
