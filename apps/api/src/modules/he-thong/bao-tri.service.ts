import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { congNgay } from '@vsn/shared';
import { ClockService } from '../../core/clock/clock.service.js';
import { HET_HAN_TOI_DA_MS } from '../../core/phien/phien-web.service.js';
import { ngayDb } from '../../core/prisma/ngay-db.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { baoBatThuong } from '../../core/sentry.js';

const MUI_GIO = 'Asia/Ho_Chi_Minh';
/** Giữ RequestDaXuLy 7 ngày (đủ cho Thử lại / gói offline đến trễ) [TDD 15.2] */
const GIU_REQUEST_NGAY = 7;
/** Kiểm tra toàn vẹn trên 35 ngày gần nhất (mọi tháng chưa khóa đang dùng) */
const KIEM_TRA_NGAY = 35;

export interface KetQuaKiemTra {
  thieuSmv: number; khongLichSu: number; lechLichSu: number; thieuChuyenGoc: number;
}

/**
 * Việc định kỳ trong API [TDD 15.2]. Không chạy nghiệp vụ — chỉ dọn bảng tạm và phát hiện bất thường.
 * 03:00 dọn dẹp · 03:30 kiểm tra toàn vẹn (có lỗi → log `error`, Sentry nhận).
 */
@Injectable()
export class BaoTriService {
  private readonly logger = new Logger(BaoTriService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  @Cron('0 3 * * *', { name: 'don-dep', timeZone: MUI_GIO })
  async donDep(): Promise<{ request: number; importTam: number; phienWeb: number }> {
    const now = this.clock.now();
    const request = await this.prisma.requestDaXuLy.deleteMany({ where: { luc: { lt: new Date(now.getTime() - GIU_REQUEST_NGAY * 86_400_000) } } });
    const importTam = await this.prisma.importTam.deleteMany({ where: { hetHanLuc: { lt: now } } });
    const phienWeb = await this.prisma.phienDangNhap.deleteMany({ where: { loai: 'WEB', taoLuc: { lt: new Date(now.getTime() - HET_HAN_TOI_DA_MS) } } });
    const kq = { request: request.count, importTam: importTam.count, phienWeb: phienWeb.count };
    this.logger.log({ ...kq }, 'Dọn dẹp định kỳ');
    return kq;
  }

  @Cron('30 3 * * *', { name: 'kiem-tra-toan-ven', timeZone: MUI_GIO })
  async kiemTraToanVen(): Promise<KetQuaKiemTra> {
    const tu = ngayDb(congNgay(this.clock.homNay(), -KIEM_TRA_NGAY));
    const [r] = await this.prisma.$queryRaw<{ thieu_smv: number; khong_lich_su: number; lech_lich_su: number; thieu_chuyen_goc: number }[]>`
      SELECT
        -- san_luong thiếu smv_snapshot dù công đoạn đã có SMV hiệu lực tại ngày đó
        (SELECT count(*)::int FROM san_luong s WHERE s.ngay_lam_viec >= ${tu} AND s.smv_snapshot IS NULL
           AND EXISTS (SELECT 1 FROM smv_lich_su h WHERE h.cong_doan_id = s.cong_doan_id AND h.ap_dung_tu_ngay <= s.ngay_lam_viec)) AS thieu_smv,
        -- bản ghi không có dòng lịch sử nào
        (SELECT count(*)::int FROM san_luong s WHERE s.ngay_lam_viec >= ${tu}
           AND NOT EXISTS (SELECT 1 FROM san_luong_lich_su l WHERE l.san_luong_id = s.id)) AS khong_lich_su,
        -- số hiện tại lệch số mới của dòng lịch sử cuối
        (SELECT count(*)::int FROM san_luong s
           JOIN LATERAL (SELECT l.so_moi FROM san_luong_lich_su l WHERE l.san_luong_id = s.id ORDER BY l.luc_server DESC, l.id DESC LIMIT 1) c ON TRUE
          WHERE s.ngay_lam_viec >= ${tu} AND c.so_moi <> s.so_luong) AS lech_lich_su,
        -- NV × ngày có sản lượng nhưng không có chuyền gốc [D18]
        (SELECT count(*)::int FROM v_nv_ngay n WHERE n.ngay_lam_viec >= ${tu} AND n.thieu_chuyen_goc) AS thieu_chuyen_goc`;
    const kq: KetQuaKiemTra = {
      thieuSmv: r?.thieu_smv ?? 0, khongLichSu: r?.khong_lich_su ?? 0, lechLichSu: r?.lech_lich_su ?? 0, thieuChuyenGoc: r?.thieu_chuyen_goc ?? 0,
    };
    if (Object.values(kq).some((n) => n > 0)) {
      this.logger.error({ ...kq }, 'Kiểm tra toàn vẹn dữ liệu: có bất thường');
      baoBatThuong('Kiểm tra toàn vẹn dữ liệu: có bất thường', { ...kq });
    } else {
      this.logger.log('Kiểm tra toàn vẹn dữ liệu: không có bất thường');
    }
    return kq;
  }
}
