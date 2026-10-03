/**
 * Kiểm tra file upload TRƯỚC khi parse [TDD 19] [D24]:
 *  - chỉ .xlsx (đuôi file + magic bytes "PK\x03\x04" của zip)
 *  - chống zip bomb: đọc thư mục trung tâm (central directory) của zip, tổng dung lượng giải nén ≤ 50 MB
 * Không ghi file ra đĩa — chỉ làm việc trên Buffer trong bộ nhớ.
 */
import { IMPORT_TOI_DA_GIAI_NEN_BYTE } from '@vsn/shared';
import { LoiNghiepVu } from '../../core/loi/loi-nghiep-vu.js';

const CHU_KY_LOCAL = 0x04034b50;
const CHU_KY_CENTRAL = 0x02014b50;
const CHU_KY_EOCD = 0x06054b50;
/** Giá trị đánh dấu ZIP64 — file Excel thật không cần, coi như quá lớn */
const ZIP64 = 0xffffffff;

const khongHopLe = (lyDo: string) => new LoiNghiepVu('FILE_KHONG_HOP_LE', { chiTiet: { lyDo } });

/** Tổng dung lượng giải nén khai báo trong central directory (byte) */
export function tongGiaiNen(buf: Buffer): number {
  // EOCD nằm ở cuối file, sau đó có thể có comment ≤ 65.535 byte
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === CHU_KY_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw khongHopLe('Không tìm thấy cấu trúc zip');

  const soMuc = buf.readUInt16LE(eocd + 10);
  const kichThuocCd = buf.readUInt32LE(eocd + 12);
  const viTriCd = buf.readUInt32LE(eocd + 16);
  if (soMuc === 0xffff || viTriCd === ZIP64 || viTriCd + kichThuocCd > eocd) throw khongHopLe('Cấu trúc zip không hỗ trợ');

  let tong = 0;
  let p = viTriCd;
  for (let i = 0; i < soMuc; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CHU_KY_CENTRAL) throw khongHopLe('Thư mục zip hỏng');
    const nen = buf.readUInt32LE(p + 20);
    const giaiNen = buf.readUInt32LE(p + 24);
    if (nen === ZIP64 || giaiNen === ZIP64) throw khongHopLe('Cấu trúc zip không hỗ trợ');
    tong += giaiNen;
    p += 46 + buf.readUInt16LE(p + 28) + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return tong;
}

export function kiemTraFileXlsx(tenFile: string, buf: Buffer): void {
  if (!/\.xlsx$/i.test(tenFile)) throw khongHopLe('Đuôi file không phải .xlsx');
  if (buf.length < 22 || buf.readUInt32LE(0) !== CHU_KY_LOCAL) throw khongHopLe('Nội dung không phải file .xlsx');
  if (tongGiaiNen(buf) > IMPORT_TOI_DA_GIAI_NEN_BYTE) {
    throw new LoiNghiepVu('FILE_KHONG_HOP_LE', {
      message: 'File giải nén quá 50 MB — không đọc được. Kiểm tra lại file hoặc tách nhỏ.',
      chiTiet: { lyDo: 'ZIP_BOMB' },
    });
  }
}
