import { Injectable, Logger } from '@nestjs/common';
import { dinhDangGio } from '@vsn/shared';
import { ClsService } from 'nestjs-cls';
import type { Prisma } from '../../generated/prisma/client.js';
import { ClockService } from '../clock/clock.service.js';
import { LoiNghiepVu } from '../loi/loi-nghiep-vu.js';
import type { NguCanhAudit, VsnClsStore } from '../ngu-canh.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

export interface BanGhiAudit {
  hanhDong: string;
  doiTuong: string;
  doiTuongId?: string | null;
  cu?: unknown;
  moi?: unknown;
  lyDo?: string | null;
}

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v === undefined || v === null ? undefined : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);

/**
 * Audit log [D9] [TDD 12]:
 *  - `giaoDich(fn)`: transaction ghi, LUÔN đặt `vsn.nguoi_thuc_hien` đầu transaction (lưới an toàn của DB dựa vào đây)
 *  - `ghi(tx, …)`: 1 dòng / thao tác nghiệp vụ, CÙNG transaction với thao tác chính; ngữ cảnh lấy từ CLS
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  /** Đã ghi audit từ chối: khóa `người|route|phút` [TDD 12.2] */
  private readonly daGhiTuChoi = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService<VsnClsStore>,
    private readonly clock: ClockService,
  ) {}

  /**
   * Truy cập ngoài quyền / ngoài phạm vi → 1 dòng audit TU_CHOI_TRUY_CAP, gộp theo (người, route, phút).
   * Lỗi ghi audit không chặn việc trả 403.
   */
  async ghiTuChoi(lyDo: 'CHUC_NANG' | 'PHAM_VI'): Promise<void> {
    const ngu = this.nguCanh();
    const route = this.cls.get('route') ?? '';
    const phut = Math.floor(this.clock.now().getTime() / 60_000);
    const khoa = `${ngu.nguoiThucHienId}|${route}|${phut}`;
    if (this.daGhiTuChoi.has(khoa)) return;
    if (this.daGhiTuChoi.size > 10_000) this.daGhiTuChoi.clear();
    this.daGhiTuChoi.add(khoa);
    try {
      await this.giaoDich((tx) =>
        this.ghi(tx, { hanhDong: 'TU_CHOI_TRUY_CAP', doiTuong: 'route', doiTuongId: route, lyDo }),
      );
    } catch (e) {
      this.logger.error({ err: e }, 'Không ghi được audit TU_CHOI_TRUY_CAP');
    }
  }

  nguCanh(): NguCanhAudit {
    return (
      this.cls.get('nguCanhAudit') ?? {
        loaiNguoiThucHien: 'HE_THONG',
        nguoiThucHienId: null,
        ip: '',
        traceId: this.cls.getId() ?? '',
      }
    );
  }

  giaoDich<T>(fn: (tx: Tx) => Promise<T>, nguCanh: NguCanhAudit = this.nguCanh()): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const nguoi = nguCanh.nguoiThucHienId ?? nguCanh.loaiNguoiThucHien;
      await tx.$executeRaw`SELECT set_config('vsn.nguoi_thuc_hien', ${nguoi}, true)`;
      return fn(tx);
    });
  }

  async ghi(tx: Tx, b: BanGhiAudit, nguCanh: NguCanhAudit = this.nguCanh()): Promise<void> {
    await tx.auditLog.create({
      data: {
        loaiNguoiThucHien: nguCanh.loaiNguoiThucHien,
        nguoiThucHienId: nguCanh.nguoiThucHienId,
        hanhDong: b.hanhDong,
        doiTuong: b.doiTuong,
        doiTuongId: b.doiTuongId ?? null,
        duLieuCu: json(b.cu),
        duLieuMoi: json(b.moi),
        lyDo: b.lyDo ?? null,
        ip: nguCanh.ip || null,
        thietBiId: nguCanh.thietBiId ?? null,
        traceId: nguCanh.traceId || null,
      },
    });
  }

  /**
   * Optimistic lock lệch → 409 "Dữ liệu đã bị [tên] thay đổi lúc hh:mm" (PRD ⑦), lấy người sửa cuối từ audit.
   */
  async loiDaThayDoi(tx: Tx, doiTuong: string, doiTuongId: string): Promise<LoiNghiepVu> {
    const cuoi = await tx.auditLog.findFirst({
      where: { doiTuong, doiTuongId },
      orderBy: { luc: 'desc' },
      select: { luc: true, nguoiThucHienId: true },
    });
    const nguoi = cuoi?.nguoiThucHienId
      ? await tx.taiKhoan.findUnique({ where: { id: cuoi.nguoiThucHienId }, select: { hoTen: true } })
      : null;
    return new LoiNghiepVu('DU_LIEU_DA_THAY_DOI', {
      message:
        cuoi && nguoi
          ? `Dữ liệu đã bị ${nguoi.hoTen} thay đổi lúc ${dinhDangGio(cuoi.luc)}, vui lòng tải lại.`
          : undefined,
    });
  }
}
