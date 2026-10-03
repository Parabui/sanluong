-- ════════════════════════════════════════════════════════════════
-- Migration khởi tạo — VSN Sản Lượng
--   Phần 0 (SQL tay, phải chạy TRƯỚC khi tạo bảng): extension, uuid_v7()
--   Phần 1 (Prisma sinh): enum, bảng, index, khóa ngoại
--   Phần 2 (SQL tay, cuối file): ràng buộc, trigger, hàm, view, phân quyền [TDD 6.3, 6.4, 6.6]
-- ════════════════════════════════════════════════════════════════

-- ── Phần 0 ──────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- UUID v7 (RFC 9562): 48 bit đầu là mili-giây epoch → khóa chính chèn tuần tự, index ít phân mảnh [TDD 6.2].
-- PostgreSQL 17 chưa có uuidv7() (có từ bản 18) → tự viết: lấy uuid v4 ngẫu nhiên, ghi đè 6 byte đầu
-- bằng mốc thời gian, đổi 4 bit phiên bản 0100 → 0111. Bit biến thể (10xx) giữ nguyên từ v4.
CREATE FUNCTION uuid_v7() RETURNS uuid
LANGUAGE sql VOLATILE PARALLEL SAFE AS $$
  SELECT encode(
    set_bit(set_bit(
      overlay(uuid_send(gen_random_uuid())
              PLACING substring(int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
              FROM 1 FOR 6),
      52, 1), 53, 1),
    'hex')::uuid
$$;

-- ── Phần 1 (Prisma sinh) ────────────────────────────────────────

-- CreateEnum
CREATE TYPE "trang_thai" AS ENUM ('HOAT_DONG', 'NGUNG');

-- CreateEnum
CREATE TYPE "loai_chuyen" AS ENUM ('CHUYEN_MAY', 'VONG_NGOAI');

-- CreateEnum
CREATE TYPE "vai_tro" AS ENUM ('SUPERADMIN', 'QUAN_LY_XUONG', 'TO_TRUONG', 'IE', 'IT_HR', 'KE_HOACH', 'BAN_GIAM_DOC', 'TV');

-- CreateEnum
CREATE TYPE "chuc_nang" AS ENUM ('TAI_KHOAN_QUAN_LY', 'DANH_MUC_XUONG_CHUYEN', 'NHAN_VIEN_QUAN_LY', 'MA_HANG_QUAN_LY', 'SO_DO_GAN', 'GIO_MAC_DINH_CAI', 'GIO_LAM_DUYET', 'SAN_LUONG_SUA', 'CHOT_NGAY', 'KHOA_THANG', 'BAO_CAO_XEM', 'DASHBOARD_XEM', 'KE_HOACH_QUAN_LY', 'XUAT_LUONG', 'CAU_HINH', 'AUDIT_XEM', 'SO_DO_TRAM_XEM');

-- CreateEnum
CREATE TYPE "nguon_san_luong" AS ENUM ('APP', 'OFFLINE', 'NHAP_HO', 'SUA_WEB');

-- CreateEnum
CREATE TYPE "ly_do_dong_phien" AS ENUM ('TU_DANG_XUAT', 'DANG_XUAT_HO', 'CHUYEN_THIET_BI');

-- CreateEnum
CREATE TYPE "loai_ngay" AS ENUM ('T2_T6', 'T7', 'CN');

-- CreateEnum
CREATE TYPE "nguon_gio" AS ENUM ('YEU_CAU_DUYET', 'TO_TRUONG_SUA');

-- CreateEnum
CREATE TYPE "trang_thai_yeu_cau_gio" AS ENUM ('CHO', 'DUYET', 'TU_CHOI');

-- CreateEnum
CREATE TYPE "trang_thai_khoa" AS ENUM ('KHOA', 'MO');

-- CreateEnum
CREATE TYPE "loai_phien" AS ENUM ('WEB', 'TV');

-- CreateEnum
CREATE TYPE "loai_nguoi_thuc_hien" AS ENUM ('TAI_KHOAN', 'NHAN_VIEN', 'HE_THONG', 'DB_TRUC_TIEP');

-- CreateEnum
CREATE TYPE "loai_chu_the" AS ENUM ('THIET_BI', 'TAI_KHOAN');

-- CreateEnum
CREATE TYPE "loai_import" AS ENUM ('NHAN_VIEN', 'MA_HANG', 'KE_HOACH');

-- CreateTable
CREATE TABLE "xuong" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "trang_thai" "trang_thai" NOT NULL DEFAULT 'HOAT_DONG',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xuong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chuyen" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "loai" "loai_chuyen" NOT NULL,
    "xuong_id" UUID NOT NULL,
    "trang_thai" "trang_thai" NOT NULL DEFAULT 'HOAT_DONG',
    "version_so_do" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chuyen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tram" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "chuyen_id" UUID NOT NULL,
    "so_tram" INTEGER NOT NULL,
    "nhap_qua_app" BOOLEAN NOT NULL DEFAULT false,
    "trang_thai" "trang_thai" NOT NULL DEFAULT 'HOAT_DONG',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nhan_vien" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "ma_nv" TEXT NOT NULL,
    "ho_ten" TEXT NOT NULL,
    "chuyen_id" UUID NOT NULL,
    "bac_tay_nghe" TEXT,
    "trang_thai" "trang_thai" NOT NULL DEFAULT 'HOAT_DONG',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhan_vien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nhan_vien_chuyen_goc" (
    "nhan_vien_id" UUID NOT NULL,
    "tu_ngay" DATE NOT NULL,
    "chuyen_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhan_vien_chuyen_goc_pkey" PRIMARY KEY ("nhan_vien_id","tu_ngay")
);

-- CreateTable
CREATE TABLE "ma_hang" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "khach_hang" TEXT,
    "so_luong_don_hang" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ma_hang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cong_doan" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "ma_hang_id" UUID NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "la_cong_doan_hoan_thanh" BOOLEAN NOT NULL DEFAULT false,
    "trang_thai" "trang_thai" NOT NULL DEFAULT 'HOAT_DONG',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cong_doan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smv_lich_su" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "cong_doan_id" UUID NOT NULL,
    "smv" DECIMAL(10,3) NOT NULL,
    "ap_dung_tu_ngay" DATE NOT NULL,
    "nguoi_tao_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smv_lich_su_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chuyen_ma_hang" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "chuyen_id" UUID NOT NULL,
    "ma_hang_id" UUID NOT NULL,
    "bat_dau" TIMESTAMPTZ(3) NOT NULL,
    "ket_thuc" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chuyen_ma_hang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gan_cong_doan" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "tram_id" UUID NOT NULL,
    "cong_doan_id" UUID NOT NULL,
    "hieu_luc_tu" TIMESTAMPTZ(3) NOT NULL,
    "hieu_luc_den" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gan_cong_doan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thiet_bi" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "tao_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lan_cuoi" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thiet_bi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phien_tram" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "tram_id" UUID NOT NULL,
    "nhan_vien_id" UUID NOT NULL,
    "ngay_lam_viec" DATE NOT NULL,
    "thiet_bi_id" UUID NOT NULL,
    "dang_nhap_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dang_xuat_luc" TIMESTAMPTZ(3),
    "dang_xuat_boi_id" UUID,
    "ly_do_dong" "ly_do_dong_phien",
    "ly_do" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phien_tram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "san_luong" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "ngay_lam_viec" DATE NOT NULL,
    "tram_id" UUID NOT NULL,
    "cong_doan_id" UUID NOT NULL,
    "nhan_vien_id" UUID NOT NULL,
    "so_luong" INTEGER NOT NULL,
    "smv_snapshot" DECIMAL(10,3),
    "chuyen_tram_snapshot" UUID NOT NULL,
    "nguon" "nguon_san_luong" NOT NULL,
    "da_dieu_chinh" BOOLEAN NOT NULL DEFAULT false,
    "canh_bao" BOOLEAN NOT NULL DEFAULT false,
    "cap_nhat_boi_tai_khoan_id" UUID,
    "cap_nhat_luc_server" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc_thiet_bi" TIMESTAMPTZ(3),
    "thu_tu_thiet_bi" BIGINT,
    "thiet_bi_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "san_luong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "san_luong_lich_su" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "san_luong_id" UUID NOT NULL,
    "so_cu" INTEGER,
    "so_moi" INTEGER NOT NULL,
    "nguon" "nguon_san_luong" NOT NULL,
    "ly_do" TEXT,
    "loai_nguoi_thuc_hien" "loai_nguoi_thuc_hien" NOT NULL,
    "nguoi_thuc_hien_id" UUID NOT NULL,
    "luc_server" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "luc_thiet_bi" TIMESTAMPTZ(3),
    "thiet_bi_id" UUID,
    "request_id" UUID,

    CONSTRAINT "san_luong_lich_su_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gio_mac_dinh" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "xuong_id" UUID NOT NULL,
    "loai_ngay" "loai_ngay" NOT NULL,
    "so_gio" DECIMAL(4,2),
    "ap_dung_tu_ngay" DATE NOT NULL,
    "nguoi_tao_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gio_mac_dinh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gio_lam" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "nhan_vien_id" UUID NOT NULL,
    "ngay_lam_viec" DATE NOT NULL,
    "so_gio" DECIMAL(4,2) NOT NULL,
    "nguon" "nguon_gio" NOT NULL,
    "ly_do" TEXT,
    "nguoi_thuc_hien_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gio_lam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yeu_cau_gio" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "nhan_vien_id" UUID NOT NULL,
    "ngay_lam_viec" DATE NOT NULL,
    "so_gio" DECIMAL(4,2) NOT NULL,
    "trang_thai" "trang_thai_yeu_cau_gio" NOT NULL DEFAULT 'CHO',
    "ly_do_tu_choi" TEXT,
    "nguoi_duyet_id" UUID,
    "duyet_luc" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yeu_cau_gio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chot_ngay" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "chuyen_id" UUID NOT NULL,
    "ngay_lam_viec" DATE NOT NULL,
    "chot_boi_id" UUID NOT NULL,
    "chot_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chot_ngay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "khoa_thang" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "ma_hang_id" UUID NOT NULL,
    "thang" TEXT NOT NULL,
    "trang_thai" "trang_thai_khoa" NOT NULL,
    "nguoi_thuc_hien_id" UUID NOT NULL,
    "ly_do" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "khoa_thang_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ke_hoach" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "ngay" DATE NOT NULL,
    "chuyen_id" UUID NOT NULL,
    "ma_hang_id" UUID NOT NULL,
    "so_luong" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ke_hoach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tai_khoan" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "ten_dang_nhap" TEXT NOT NULL,
    "ho_ten" TEXT NOT NULL,
    "mat_khau_hash" TEXT NOT NULL,
    "vai_tro" "vai_tro" NOT NULL,
    "trang_thai" "trang_thai" NOT NULL DEFAULT 'HOAT_DONG',
    "phai_doi_mat_khau" BOOLEAN NOT NULL DEFAULT true,
    "so_lan_sai" INTEGER NOT NULL DEFAULT 0,
    "khoa_den" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tai_khoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phien_dang_nhap" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "token_hash" TEXT NOT NULL,
    "tai_khoan_id" UUID NOT NULL,
    "loai" "loai_phien" NOT NULL,
    "tao_luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lan_cuoi" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "phien_dang_nhap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tai_khoan_chuyen" (
    "tai_khoan_id" UUID NOT NULL,
    "chuyen_id" UUID NOT NULL,

    CONSTRAINT "tai_khoan_chuyen_pkey" PRIMARY KEY ("tai_khoan_id","chuyen_id")
);

-- CreateTable
CREATE TABLE "tai_khoan_xuong" (
    "tai_khoan_id" UUID NOT NULL,
    "xuong_id" UUID NOT NULL,

    CONSTRAINT "tai_khoan_xuong_pkey" PRIMARY KEY ("tai_khoan_id","xuong_id")
);

-- CreateTable
CREATE TABLE "quyen_vai_tro" (
    "vai_tro" "vai_tro" NOT NULL,
    "chuc_nang" "chuc_nang" NOT NULL,
    "bat_tat" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quyen_vai_tro_pkey" PRIMARY KEY ("vai_tro","chuc_nang")
);

-- CreateTable
CREATE TABLE "cau_hinh" (
    "khoa" TEXT NOT NULL,
    "gia_tri" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cau_hinh_pkey" PRIMARY KEY ("khoa")
);

-- CreateTable
CREATE TABLE "lich_su_xuat_luong" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "thang" TEXT NOT NULL,
    "nguoi_xuat_id" UUID NOT NULL,
    "luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "so_dong" INTEGER NOT NULL,

    CONSTRAINT "lich_su_xuat_luong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_da_xu_ly" (
    "chu_the_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "loai_chu_the" "loai_chu_the" NOT NULL,
    "ket_qua" JSONB,
    "luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_da_xu_ly_pkey" PRIMARY KEY ("chu_the_id","request_id")
);

-- CreateTable
CREATE TABLE "import_tam" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "loai" "loai_import" NOT NULL,
    "nguoi_tao_id" UUID NOT NULL,
    "du_lieu" JSONB NOT NULL,
    "het_han_luc" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_tam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT uuid_v7(),
    "luc" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loai_nguoi_thuc_hien" "loai_nguoi_thuc_hien" NOT NULL,
    "nguoi_thuc_hien_id" UUID,
    "db_user" TEXT,
    "hanh_dong" TEXT NOT NULL,
    "doi_tuong" TEXT NOT NULL,
    "doi_tuong_id" TEXT,
    "du_lieu_cu" JSONB,
    "du_lieu_moi" JSONB,
    "ly_do" TEXT,
    "ip" TEXT,
    "thiet_bi_id" UUID,
    "trace_id" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "xuong_ma_key" ON "xuong"("ma");

-- CreateIndex
CREATE UNIQUE INDEX "chuyen_ma_key" ON "chuyen"("ma");

-- CreateIndex
CREATE INDEX "chuyen_xuong_id_idx" ON "chuyen"("xuong_id");

-- CreateIndex
CREATE UNIQUE INDEX "tram_chuyen_id_so_tram_key" ON "tram"("chuyen_id", "so_tram");

-- CreateIndex
CREATE UNIQUE INDEX "nhan_vien_ma_nv_key" ON "nhan_vien"("ma_nv");

-- CreateIndex
CREATE INDEX "nhan_vien_chuyen_id_idx" ON "nhan_vien"("chuyen_id");

-- CreateIndex
CREATE UNIQUE INDEX "ma_hang_ma_key" ON "ma_hang"("ma");

-- CreateIndex
CREATE UNIQUE INDEX "cong_doan_ma_hang_id_ma_key" ON "cong_doan"("ma_hang_id", "ma");

-- CreateIndex
CREATE UNIQUE INDEX "smv_lich_su_cong_doan_id_ap_dung_tu_ngay_key" ON "smv_lich_su"("cong_doan_id", "ap_dung_tu_ngay");

-- CreateIndex
CREATE INDEX "chuyen_ma_hang_chuyen_id_idx" ON "chuyen_ma_hang"("chuyen_id");

-- CreateIndex
CREATE INDEX "chuyen_ma_hang_ma_hang_id_idx" ON "chuyen_ma_hang"("ma_hang_id");

-- CreateIndex
CREATE INDEX "gan_cong_doan_tram_id_hieu_luc_tu_hieu_luc_den_idx" ON "gan_cong_doan"("tram_id", "hieu_luc_tu", "hieu_luc_den");

-- CreateIndex
CREATE INDEX "gan_cong_doan_cong_doan_id_idx" ON "gan_cong_doan"("cong_doan_id");

-- CreateIndex
CREATE UNIQUE INDEX "thiet_bi_token_hash_key" ON "thiet_bi"("token_hash");

-- CreateIndex
CREATE INDEX "phien_tram_thiet_bi_id_ngay_lam_viec_idx" ON "phien_tram"("thiet_bi_id", "ngay_lam_viec");

-- CreateIndex
CREATE INDEX "phien_tram_nhan_vien_id_ngay_lam_viec_idx" ON "phien_tram"("nhan_vien_id", "ngay_lam_viec");

-- CreateIndex
CREATE INDEX "san_luong_ngay_lam_viec_chuyen_tram_snapshot_idx" ON "san_luong"("ngay_lam_viec", "chuyen_tram_snapshot");

-- CreateIndex
CREATE INDEX "san_luong_nhan_vien_id_ngay_lam_viec_idx" ON "san_luong"("nhan_vien_id", "ngay_lam_viec");

-- CreateIndex
CREATE INDEX "san_luong_cong_doan_id_ngay_lam_viec_idx" ON "san_luong"("cong_doan_id", "ngay_lam_viec");

-- CreateIndex
CREATE UNIQUE INDEX "ux_san_luong_key" ON "san_luong"("ngay_lam_viec", "tram_id", "cong_doan_id", "nhan_vien_id");

-- CreateIndex
CREATE INDEX "san_luong_lich_su_san_luong_id_luc_server_idx" ON "san_luong_lich_su"("san_luong_id", "luc_server");

-- CreateIndex
CREATE UNIQUE INDEX "gio_mac_dinh_xuong_id_loai_ngay_ap_dung_tu_ngay_key" ON "gio_mac_dinh"("xuong_id", "loai_ngay", "ap_dung_tu_ngay");

-- CreateIndex
CREATE UNIQUE INDEX "gio_lam_nhan_vien_id_ngay_lam_viec_key" ON "gio_lam"("nhan_vien_id", "ngay_lam_viec");

-- CreateIndex
CREATE INDEX "yeu_cau_gio_nhan_vien_id_ngay_lam_viec_idx" ON "yeu_cau_gio"("nhan_vien_id", "ngay_lam_viec");

-- CreateIndex
CREATE UNIQUE INDEX "chot_ngay_chuyen_id_ngay_lam_viec_key" ON "chot_ngay"("chuyen_id", "ngay_lam_viec");

-- CreateIndex
CREATE UNIQUE INDEX "khoa_thang_ma_hang_id_thang_key" ON "khoa_thang"("ma_hang_id", "thang");

-- CreateIndex
CREATE UNIQUE INDEX "ke_hoach_ngay_chuyen_id_ma_hang_id_key" ON "ke_hoach"("ngay", "chuyen_id", "ma_hang_id");

-- CreateIndex
CREATE UNIQUE INDEX "tai_khoan_ten_dang_nhap_key" ON "tai_khoan"("ten_dang_nhap");

-- CreateIndex
CREATE UNIQUE INDEX "phien_dang_nhap_token_hash_key" ON "phien_dang_nhap"("token_hash");

-- CreateIndex
CREATE INDEX "phien_dang_nhap_tai_khoan_id_idx" ON "phien_dang_nhap"("tai_khoan_id");

-- CreateIndex
CREATE INDEX "tai_khoan_chuyen_chuyen_id_idx" ON "tai_khoan_chuyen"("chuyen_id");

-- CreateIndex
CREATE INDEX "tai_khoan_xuong_xuong_id_idx" ON "tai_khoan_xuong"("xuong_id");

-- CreateIndex
CREATE INDEX "request_da_xu_ly_luc_idx" ON "request_da_xu_ly"("luc");

-- CreateIndex
CREATE INDEX "import_tam_het_han_luc_idx" ON "import_tam"("het_han_luc");

-- CreateIndex
CREATE INDEX "audit_log_luc_idx" ON "audit_log"("luc" DESC);

-- CreateIndex
CREATE INDEX "audit_log_doi_tuong_doi_tuong_id_idx" ON "audit_log"("doi_tuong", "doi_tuong_id");

-- AddForeignKey
ALTER TABLE "chuyen" ADD CONSTRAINT "chuyen_xuong_id_fkey" FOREIGN KEY ("xuong_id") REFERENCES "xuong"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tram" ADD CONSTRAINT "tram_chuyen_id_fkey" FOREIGN KEY ("chuyen_id") REFERENCES "chuyen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nhan_vien" ADD CONSTRAINT "nhan_vien_chuyen_id_fkey" FOREIGN KEY ("chuyen_id") REFERENCES "chuyen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nhan_vien_chuyen_goc" ADD CONSTRAINT "nhan_vien_chuyen_goc_nhan_vien_id_fkey" FOREIGN KEY ("nhan_vien_id") REFERENCES "nhan_vien"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nhan_vien_chuyen_goc" ADD CONSTRAINT "nhan_vien_chuyen_goc_chuyen_id_fkey" FOREIGN KEY ("chuyen_id") REFERENCES "chuyen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cong_doan" ADD CONSTRAINT "cong_doan_ma_hang_id_fkey" FOREIGN KEY ("ma_hang_id") REFERENCES "ma_hang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smv_lich_su" ADD CONSTRAINT "smv_lich_su_cong_doan_id_fkey" FOREIGN KEY ("cong_doan_id") REFERENCES "cong_doan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smv_lich_su" ADD CONSTRAINT "smv_lich_su_nguoi_tao_id_fkey" FOREIGN KEY ("nguoi_tao_id") REFERENCES "tai_khoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chuyen_ma_hang" ADD CONSTRAINT "chuyen_ma_hang_chuyen_id_fkey" FOREIGN KEY ("chuyen_id") REFERENCES "chuyen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chuyen_ma_hang" ADD CONSTRAINT "chuyen_ma_hang_ma_hang_id_fkey" FOREIGN KEY ("ma_hang_id") REFERENCES "ma_hang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gan_cong_doan" ADD CONSTRAINT "gan_cong_doan_tram_id_fkey" FOREIGN KEY ("tram_id") REFERENCES "tram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gan_cong_doan" ADD CONSTRAINT "gan_cong_doan_cong_doan_id_fkey" FOREIGN KEY ("cong_doan_id") REFERENCES "cong_doan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phien_tram" ADD CONSTRAINT "phien_tram_tram_id_fkey" FOREIGN KEY ("tram_id") REFERENCES "tram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phien_tram" ADD CONSTRAINT "phien_tram_nhan_vien_id_fkey" FOREIGN KEY ("nhan_vien_id") REFERENCES "nhan_vien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phien_tram" ADD CONSTRAINT "phien_tram_thiet_bi_id_fkey" FOREIGN KEY ("thiet_bi_id") REFERENCES "thiet_bi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phien_tram" ADD CONSTRAINT "phien_tram_dang_xuat_boi_id_fkey" FOREIGN KEY ("dang_xuat_boi_id") REFERENCES "tai_khoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "san_luong" ADD CONSTRAINT "san_luong_tram_id_fkey" FOREIGN KEY ("tram_id") REFERENCES "tram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "san_luong" ADD CONSTRAINT "san_luong_cong_doan_id_fkey" FOREIGN KEY ("cong_doan_id") REFERENCES "cong_doan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "san_luong" ADD CONSTRAINT "san_luong_nhan_vien_id_fkey" FOREIGN KEY ("nhan_vien_id") REFERENCES "nhan_vien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "san_luong" ADD CONSTRAINT "san_luong_chuyen_tram_snapshot_fkey" FOREIGN KEY ("chuyen_tram_snapshot") REFERENCES "chuyen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "san_luong" ADD CONSTRAINT "san_luong_thiet_bi_id_fkey" FOREIGN KEY ("thiet_bi_id") REFERENCES "thiet_bi"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "san_luong" ADD CONSTRAINT "san_luong_cap_nhat_boi_tai_khoan_id_fkey" FOREIGN KEY ("cap_nhat_boi_tai_khoan_id") REFERENCES "tai_khoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "san_luong_lich_su" ADD CONSTRAINT "san_luong_lich_su_san_luong_id_fkey" FOREIGN KEY ("san_luong_id") REFERENCES "san_luong"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gio_mac_dinh" ADD CONSTRAINT "gio_mac_dinh_xuong_id_fkey" FOREIGN KEY ("xuong_id") REFERENCES "xuong"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gio_mac_dinh" ADD CONSTRAINT "gio_mac_dinh_nguoi_tao_id_fkey" FOREIGN KEY ("nguoi_tao_id") REFERENCES "tai_khoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gio_lam" ADD CONSTRAINT "gio_lam_nhan_vien_id_fkey" FOREIGN KEY ("nhan_vien_id") REFERENCES "nhan_vien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gio_lam" ADD CONSTRAINT "gio_lam_nguoi_thuc_hien_id_fkey" FOREIGN KEY ("nguoi_thuc_hien_id") REFERENCES "tai_khoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yeu_cau_gio" ADD CONSTRAINT "yeu_cau_gio_nhan_vien_id_fkey" FOREIGN KEY ("nhan_vien_id") REFERENCES "nhan_vien"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yeu_cau_gio" ADD CONSTRAINT "yeu_cau_gio_nguoi_duyet_id_fkey" FOREIGN KEY ("nguoi_duyet_id") REFERENCES "tai_khoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chot_ngay" ADD CONSTRAINT "chot_ngay_chuyen_id_fkey" FOREIGN KEY ("chuyen_id") REFERENCES "chuyen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chot_ngay" ADD CONSTRAINT "chot_ngay_chot_boi_id_fkey" FOREIGN KEY ("chot_boi_id") REFERENCES "tai_khoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "khoa_thang" ADD CONSTRAINT "khoa_thang_ma_hang_id_fkey" FOREIGN KEY ("ma_hang_id") REFERENCES "ma_hang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "khoa_thang" ADD CONSTRAINT "khoa_thang_nguoi_thuc_hien_id_fkey" FOREIGN KEY ("nguoi_thuc_hien_id") REFERENCES "tai_khoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ke_hoach" ADD CONSTRAINT "ke_hoach_chuyen_id_fkey" FOREIGN KEY ("chuyen_id") REFERENCES "chuyen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ke_hoach" ADD CONSTRAINT "ke_hoach_ma_hang_id_fkey" FOREIGN KEY ("ma_hang_id") REFERENCES "ma_hang"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phien_dang_nhap" ADD CONSTRAINT "phien_dang_nhap_tai_khoan_id_fkey" FOREIGN KEY ("tai_khoan_id") REFERENCES "tai_khoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tai_khoan_chuyen" ADD CONSTRAINT "tai_khoan_chuyen_tai_khoan_id_fkey" FOREIGN KEY ("tai_khoan_id") REFERENCES "tai_khoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tai_khoan_chuyen" ADD CONSTRAINT "tai_khoan_chuyen_chuyen_id_fkey" FOREIGN KEY ("chuyen_id") REFERENCES "chuyen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tai_khoan_xuong" ADD CONSTRAINT "tai_khoan_xuong_tai_khoan_id_fkey" FOREIGN KEY ("tai_khoan_id") REFERENCES "tai_khoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tai_khoan_xuong" ADD CONSTRAINT "tai_khoan_xuong_xuong_id_fkey" FOREIGN KEY ("xuong_id") REFERENCES "xuong"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lich_su_xuat_luong" ADD CONSTRAINT "lich_su_xuat_luong_nguoi_xuat_id_fkey" FOREIGN KEY ("nguoi_xuat_id") REFERENCES "tai_khoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_tam" ADD CONSTRAINT "import_tam_nguoi_tao_id_fkey" FOREIGN KEY ("nguoi_tao_id") REFERENCES "tai_khoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Phần 2 (SQL tay) ────────────────────────────────────────────
-- Quy ước lỗi: trigger RAISE EXCEPTION với message = mã lỗi trong @vsn/shared/loi (vd. 'THANG_DA_KHOA')
-- để API chuyển thành LoiNghiepVu. Mã không có trong danh mục = lỗi lập trình → 500.

-- ═══ 2.1 updated_at do DB đặt (đúng cả khi ghi bằng SQL tay, vd. upsert san_luong) ═══
CREATE FUNCTION dat_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at' AND tb.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('CREATE TRIGGER tg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION dat_updated_at()', t, t);
  END LOOP;
END $$;
-- ⚠ Bảng mới có cột updated_at ở migration sau phải tự thêm trigger này.

-- ═══ 2.2 CHECK ═══
ALTER TABLE nhan_vien      ADD CONSTRAINT ck_ma_nv_chuan_hoa   CHECK (ma_nv <> '' AND ma_nv = upper(btrim(ma_nv)));  -- [R 3.4]
ALTER TABLE tram           ADD CONSTRAINT ck_so_tram           CHECK (so_tram > 0);
ALTER TABLE ma_hang        ADD CONSTRAINT ck_so_luong_don_hang CHECK (so_luong_don_hang > 0);
ALTER TABLE smv_lich_su    ADD CONSTRAINT ck_smv               CHECK (smv > 0);
ALTER TABLE chuyen_ma_hang ADD CONSTRAINT ck_ket_thuc          CHECK (ket_thuc IS NULL OR ket_thuc >= bat_dau);
ALTER TABLE gan_cong_doan  ADD CONSTRAINT ck_hieu_luc          CHECK (hieu_luc_den IS NULL OR hieu_luc_den >= hieu_luc_tu);
ALTER TABLE ke_hoach       ADD CONSTRAINT ck_so_luong_ke_hoach CHECK (so_luong > 0);
ALTER TABLE tai_khoan      ADD CONSTRAINT ck_so_lan_sai        CHECK (so_lan_sai >= 0);
ALTER TABLE khoa_thang         ADD CONSTRAINT ck_thang CHECK (thang ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE lich_su_xuat_luong ADD CONSTRAINT ck_thang CHECK (thang ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- [R 1.1] Số lượng hợp lệ
ALTER TABLE san_luong         ADD CONSTRAINT ck_so_luong CHECK (so_luong BETWEEN 0 AND 99999);
ALTER TABLE san_luong_lich_su ADD CONSTRAINT ck_so_moi   CHECK (so_moi BETWEEN 0 AND 99999);
-- Nguồn app ⇔ không có tài khoản cập nhật; nguồn Web ⇔ Ô đã điều chỉnh [R 5.4]
ALTER TABLE san_luong ADD CONSTRAINT ck_nguoi_cap_nhat
  CHECK ((nguon IN ('APP', 'OFFLINE')) = (cap_nhat_boi_tai_khoan_id IS NULL));
ALTER TABLE san_luong ADD CONSTRAINT ck_da_dieu_chinh
  CHECK (da_dieu_chinh = (nguon IN ('NHAP_HO', 'SUA_WEB')));

-- Phiên trạm: đã đóng ⇔ có lý do đóng; đăng xuất hộ bắt buộc người thực hiện + lý do [D26]
ALTER TABLE phien_tram ADD CONSTRAINT ck_dong_phien CHECK ((dang_xuat_luc IS NULL) = (ly_do_dong IS NULL));
ALTER TABLE phien_tram ADD CONSTRAINT ck_dang_xuat_ho
  CHECK (ly_do_dong IS DISTINCT FROM 'DANG_XUAT_HO' OR (dang_xuat_boi_id IS NOT NULL AND btrim(coalesce(ly_do, '')) <> ''));

-- F6
ALTER TABLE gio_mac_dinh ADD CONSTRAINT ck_so_gio_md CHECK (so_gio IS NULL OR (so_gio > 0 AND so_gio <= 16));
ALTER TABLE gio_lam      ADD CONSTRAINT ck_so_gio    CHECK (so_gio > 0 AND so_gio <= 16);
ALTER TABLE yeu_cau_gio  ADD CONSTRAINT ck_so_gio_yc CHECK (so_gio > 0 AND so_gio <= 16);
ALTER TABLE gio_lam      ADD CONSTRAINT ck_sua_gio_co_ly_do
  CHECK (nguon <> 'TO_TRUONG_SUA' OR btrim(coalesce(ly_do, '')) <> '');                       -- [R 4.2]
ALTER TABLE yeu_cau_gio  ADD CONSTRAINT ck_tu_choi_co_ly_do
  CHECK (trang_thai <> 'TU_CHOI' OR btrim(coalesce(ly_do_tu_choi, '')) <> '');

-- F8: quyền Quản lý tài khoản của Superadmin không tắt được
ALTER TABLE quyen_vai_tro ADD CONSTRAINT ck_superadmin_tai_khoan
  CHECK (NOT (vai_tro = 'SUPERADMIN' AND chuc_nang = 'TAI_KHOAN_QUAN_LY' AND NOT bat_tat));

-- ═══ 2.3 Partial UNIQUE & EXCLUDE ═══

-- [R 1] Mỗi trạm × ngày chỉ 1 phiên đang hoạt động (chống 2 người đăng nhập cùng lúc, R 3.9)
CREATE UNIQUE INDEX ux_phien_tram_dang_hoat_dong
  ON phien_tram (tram_id, ngay_lam_viec) WHERE dang_xuat_luc IS NULL;

-- [R 1.3] Một thiết bị = một mã NV trong một ngày (được nhiều trạm)
ALTER TABLE phien_tram ADD CONSTRAINT ex_thiet_bi_mot_nv_mot_ngay
  EXCLUDE USING gist (thiet_bi_id WITH =, ngay_lam_viec WITH =, nhan_vien_id WITH <>)
  WHERE (dang_xuat_luc IS NULL);

-- F3: mỗi mã hàng tối đa 1 công đoạn hoàn thành (đủ 1 kiểm ở service khi lưu/import)
CREATE UNIQUE INDEX ux_cong_doan_hoan_thanh
  ON cong_doan (ma_hang_id) WHERE la_cong_doan_hoan_thanh;

-- [R 3.6] Lịch sử gán: cùng (trạm, công đoạn) không có 2 khoảng hiệu lực chồng nhau
ALTER TABLE gan_cong_doan ADD CONSTRAINT ex_gan_khong_chong
  EXCLUDE USING gist (tram_id WITH =, cong_doan_id WITH =,
                      tstzrange(hieu_luc_tu, hieu_luc_den) WITH &&);

-- F6: tối đa 1 yêu cầu giờ đang chờ / NV × ngày
CREATE UNIQUE INDEX ux_yeu_cau_gio_cho
  ON yeu_cau_gio (nhan_vien_id, ngay_lam_viec) WHERE trang_thai = 'CHO';

-- F4: một mã hàng chỉ có 1 dòng đang chạy trên một chuyền
CREATE UNIQUE INDEX ux_chuyen_ma_hang_dang_chay
  ON chuyen_ma_hang (chuyen_id, ma_hang_id) WHERE ket_thuc IS NULL;

-- ═══ 2.4 Hàm dùng chung ═══

-- Khớp loaiNgay() trong @vsn/shared/ngay-lam-viec (có test đối chiếu)
CREATE FUNCTION loai_ngay(d date) RETURNS loai_ngay IMMUTABLE LANGUAGE sql AS $$
  SELECT (CASE EXTRACT(ISODOW FROM d) WHEN 6 THEN 'T7' WHEN 7 THEN 'CN' ELSE 'T2_T6' END)::loai_ngay $$;

-- [D18] Chuyền gốc của NV tại ngày D — nguồn duy nhất (view, phamViGioLam, báo cáo "Hỗ trợ từ chuyền X")
CREATE FUNCTION chuyen_goc_ngay(nv uuid, d date) RETURNS uuid STABLE LANGUAGE sql AS $$
  SELECT chuyen_id FROM nhan_vien_chuyen_goc
  WHERE nhan_vien_id = nv AND tu_ngay <= d ORDER BY tu_ngay DESC LIMIT 1 $$;

-- Trạng thái của một ô (chuyền, ngày, mã hàng): CHUA_CHOT / DA_CHOT / DA_KHOA [TDD 6.6, 8.10]
CREATE FUNCTION trang_thai_ngay(p_chuyen uuid, p_ngay date, p_ma_hang uuid) RETURNS text STABLE LANGUAGE sql AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM khoa_thang
                 WHERE ma_hang_id = p_ma_hang AND thang = to_char(p_ngay, 'YYYY-MM') AND trang_thai = 'KHOA')
      THEN 'DA_KHOA'
    WHEN EXISTS (SELECT 1 FROM chot_ngay WHERE chuyen_id = p_chuyen AND ngay_lam_viec = p_ngay)
      THEN 'DA_CHOT'
    ELSE 'CHUA_CHOT' END $$;

-- [R 5.7] Giờ làm NV × ngày bị khóa khi có sản lượng của NV ngày đó thuộc một (mã hàng, tháng) đang KHOA
CREATE FUNCTION gio_lam_bi_khoa(p_nv uuid, p_ngay date) RETURNS boolean STABLE LANGUAGE sql AS $$
  SELECT EXISTS (
    SELECT 1 FROM san_luong s
    JOIN cong_doan cd ON cd.id = s.cong_doan_id
    JOIN khoa_thang k ON k.ma_hang_id = cd.ma_hang_id
     AND k.thang = to_char(s.ngay_lam_viec, 'YYYY-MM') AND k.trang_thai = 'KHOA'
    WHERE s.nhan_vien_id = p_nv AND s.ngay_lam_viec = p_ngay) $$;

-- ═══ 2.5 Trigger ═══

-- [D17] Trạm không bao giờ đổi chuyền
CREATE FUNCTION chan_doi_chuyen_tram() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.chuyen_id IS DISTINCT FROM OLD.chuyen_id THEN
    RAISE EXCEPTION 'TRAM_KHONG_DOI_CHUYEN';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_tram_chuyen_bat_bien BEFORE UPDATE OF chuyen_id ON tram
  FOR EACH ROW EXECUTE FUNCTION chan_doi_chuyen_tram();

-- [D18] Lịch sử chuyền gốc: tự ghi khi INSERT NV hoặc đổi chuyen_id (F2 và import đều đi qua đây)
--   tu_ngay = ngày làm việc hiện tại theo giờ VN; sửa nhiều lần trong ngày → lần cuối thắng.
--   SECURITY DEFINER: vsn_app không có quyền ghi trực tiếp nhan_vien_chuyen_goc (mục 2.7).
CREATE FUNCTION ghi_chuyen_goc() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO nhan_vien_chuyen_goc (nhan_vien_id, tu_ngay, chuyen_id)
  VALUES (NEW.id, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, NEW.chuyen_id)
  ON CONFLICT (nhan_vien_id, tu_ngay) DO UPDATE SET chuyen_id = EXCLUDED.chuyen_id;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_nv_chuyen_goc_them AFTER INSERT ON nhan_vien
  FOR EACH ROW EXECUTE FUNCTION ghi_chuyen_goc();
CREATE TRIGGER tg_nv_chuyen_goc_doi AFTER UPDATE OF chuyen_id ON nhan_vien
  FOR EACH ROW WHEN (OLD.chuyen_id IS DISTINCT FROM NEW.chuyen_id) EXECUTE FUNCTION ghi_chuyen_goc();

-- F4: mỗi chuyền tối đa 2 mã hàng đang chạy. Khóa dòng chuyen (NO KEY UPDATE — không chặn kiểm tra FK)
--     để 2 lần thêm đồng thời không cùng lọt qua bước đếm.
CREATE FUNCTION chan_qua_2_ma_hang() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ket_thuc IS NULL THEN
    PERFORM 1 FROM chuyen WHERE id = NEW.chuyen_id FOR NO KEY UPDATE;
    IF (SELECT count(*) FROM chuyen_ma_hang
        WHERE chuyen_id = NEW.chuyen_id AND ket_thuc IS NULL AND id <> NEW.id) >= 2 THEN
      RAISE EXCEPTION 'QUA_2_MA_HANG';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_chuyen_ma_hang_toi_da_2 BEFORE INSERT OR UPDATE OF ket_thuc, chuyen_id ON chuyen_ma_hang
  FOR EACH ROW EXECUTE FUNCTION chan_qua_2_ma_hang();

-- [D9] Bảng chỉ-thêm: AuditLog, SanLuongLichSu, LichSuXuatLuong — chặn cả chủ bảng
CREATE FUNCTION chan_sua_xoa() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Bảng % chỉ được thêm, không được sửa/xóa', TG_TABLE_NAME;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_log', 'san_luong_lich_su', 'lich_su_xuat_luong'] LOOP
    EXECUTE format('CREATE TRIGGER tg_%s_chi_them BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION chan_sua_xoa()', t, t);
    EXECUTE format('CREATE TRIGGER tg_%s_khong_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION chan_sua_xoa()', t, t);
  END LOOP;
END $$;

-- Bảo vệ san_luong — DB là hàng rào cuối (N2). GhiSanLuongService đã kiểm tra trước dưới khóa advisory;
-- trigger chỉ chặn khi code có bug hoặc ghi thẳng vào DB.
--   ① INSERT: chuyen_tram_snapshot phải = chuyền của trạm [D17]
--   ② UPDATE: khóa bản ghi (ngày, trạm, công đoạn, NV) và chuyen_tram_snapshot bất biến [CLAUDE.md #13]
--   ③ (mã hàng, tháng) đang KHOA → chặn mọi thay đổi, kể cả tính lại SMV [R 5.5] [TDD 8.5]
--   ④ Ghi từ app (đổi số / thiết bị): chặn khi ngày đã chốt [F10] hoặc ô đã điều chỉnh [R 5.4]
CREATE FUNCTION bao_ve_san_luong() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v san_luong%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN v := OLD; ELSE v := NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.chuyen_tram_snapshot IS DISTINCT FROM (SELECT chuyen_id FROM tram WHERE id = NEW.tram_id) THEN
      RAISE EXCEPTION 'SNAPSHOT_CHUYEN_SAI';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.ngay_lam_viec, NEW.tram_id, NEW.cong_doan_id, NEW.nhan_vien_id, NEW.chuyen_tram_snapshot)
       IS DISTINCT FROM (OLD.ngay_lam_viec, OLD.tram_id, OLD.cong_doan_id, OLD.nhan_vien_id, OLD.chuyen_tram_snapshot) THEN
      RAISE EXCEPTION 'KHOA_SAN_LUONG_BAT_BIEN';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM cong_doan cd
             JOIN khoa_thang k ON k.ma_hang_id = cd.ma_hang_id
              AND k.thang = to_char(v.ngay_lam_viec, 'YYYY-MM') AND k.trang_thai = 'KHOA'
             WHERE cd.id = v.cong_doan_id) THEN
    RAISE EXCEPTION 'THANG_DA_KHOA';
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.nguon IN ('APP', 'OFFLINE')
     AND (TG_OP = 'INSERT'
          OR (NEW.so_luong, NEW.thu_tu_thiet_bi, NEW.thiet_bi_id, NEW.nguon)
             IS DISTINCT FROM (OLD.so_luong, OLD.thu_tu_thiet_bi, OLD.thiet_bi_id, OLD.nguon)) THEN
    IF TG_OP = 'UPDATE' AND OLD.da_dieu_chinh THEN
      RAISE EXCEPTION 'O_DA_DIEU_CHINH';
    END IF;
    IF EXISTS (SELECT 1 FROM chot_ngay
               WHERE chuyen_id = NEW.chuyen_tram_snapshot AND ngay_lam_viec = NEW.ngay_lam_viec) THEN
      RAISE EXCEPTION 'NGAY_DA_CHOT';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_san_luong_bao_ve BEFORE INSERT OR UPDATE OR DELETE ON san_luong
  FOR EACH ROW EXECUTE FUNCTION bao_ve_san_luong();

-- [R 5.7] Giờ làm của NV × ngày đã khóa không sửa được
CREATE FUNCTION bao_ve_gio_lam() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND gio_lam_bi_khoa(OLD.nhan_vien_id, OLD.ngay_lam_viec) THEN
    RAISE EXCEPTION 'THANG_DA_KHOA';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND gio_lam_bi_khoa(NEW.nhan_vien_id, NEW.ngay_lam_viec) THEN
    RAISE EXCEPTION 'THANG_DA_KHOA';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tg_gio_lam_bao_ve BEFORE INSERT OR UPDATE OR DELETE ON gio_lam
  FOR EACH ROW EXECUTE FUNCTION bao_ve_gio_lam();

-- [D9] Lưới an toàn: thay đổi san_luong / gio_lam KHÔNG đi qua ứng dụng → 1 dòng audit DB_TRUC_TIEP.
--   Ứng dụng luôn chạy `SELECT set_config('vsn.nguoi_thuc_hien', <id>, true)` đầu mỗi transaction ghi
--   (true = chỉ trong transaction; hết transaction giá trị về rỗng).
CREATE FUNCTION luoi_an_toan_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('vsn.nguoi_thuc_hien', true), '') <> '' THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (loai_nguoi_thuc_hien, db_user, hanh_dong, doi_tuong, doi_tuong_id, du_lieu_moi)
    VALUES ('DB_TRUC_TIEP', current_user, 'DB_TRUC_TIEP', TG_TABLE_NAME, NEW.id::text, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (loai_nguoi_thuc_hien, db_user, hanh_dong, doi_tuong, doi_tuong_id, du_lieu_cu, du_lieu_moi)
    VALUES ('DB_TRUC_TIEP', current_user, 'DB_TRUC_TIEP', TG_TABLE_NAME, NEW.id::text, to_jsonb(OLD), to_jsonb(NEW));
  ELSE
    INSERT INTO audit_log (loai_nguoi_thuc_hien, db_user, hanh_dong, doi_tuong, doi_tuong_id, du_lieu_cu)
    VALUES ('DB_TRUC_TIEP', current_user, 'DB_TRUC_TIEP', TG_TABLE_NAME, OLD.id::text, to_jsonb(OLD));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER tg_san_luong_luoi_an_toan AFTER INSERT OR UPDATE OR DELETE ON san_luong
  FOR EACH ROW EXECUTE FUNCTION luoi_an_toan_audit();
CREATE TRIGGER tg_gio_lam_luoi_an_toan AFTER INSERT OR UPDATE OR DELETE ON gio_lam
  FOR EACH ROW EXECUTE FUNCTION luoi_an_toan_audit();

-- ═══ 2.6 View — nguồn duy nhất của công thức [D4] [D10] ═══
-- F5, F7, F11, F15 BẮT BUỘC đọc qua 3 view này, không tự tính lại ở code [CLAUDE.md #5].

-- Mức bản ghi: phút SMV từng dòng
CREATE VIEW v_san_luong_chi_tiet AS
SELECT sl.*, cd.ma_hang_id,
       sl.so_luong * sl.smv_snapshot / 60.0 AS phut_smv       -- NULL nếu công đoạn chưa có SMV
FROM san_luong sl JOIN cong_doan cd ON cd.id = sl.cong_doan_id;

-- Mức NV × ngày: tổng phút SMV, giờ làm hiệu lực, % hiệu suất
CREATE VIEW v_nv_ngay AS
WITH sl AS (
  SELECT s.nhan_vien_id, s.ngay_lam_viec,
         SUM(s.so_luong)                                 AS tong_san_luong,
         SUM(s.so_luong * s.smv_snapshot) / 60.0         AS phut_smv,
         BOOL_OR(s.smv_snapshot IS NULL)                 AS thieu_smv,
         BOOL_OR(k.ma_hang_id IS NULL)                   AS hieu_suat_tam_tinh   -- [D20] còn mã hàng chưa khóa
  FROM san_luong s
  JOIN cong_doan cd ON cd.id = s.cong_doan_id
  LEFT JOIN khoa_thang k ON k.ma_hang_id = cd.ma_hang_id
       AND k.thang = to_char(s.ngay_lam_viec, 'YYYY-MM') AND k.trang_thai = 'KHOA'
  GROUP BY s.nhan_vien_id, s.ngay_lam_viec)
SELECT sl.*,
       g.chuyen_goc_id,
       (c.id IS NULL)                            AS thieu_chuyen_goc, -- [D18] KHÔNG làm mất dòng; job 03:30 cảnh báo
       COALESCE(gl.so_gio, gmd.so_gio)          AS gio_lam,          -- NULL = chưa có giờ (CN, lễ, thiếu chuyền gốc)
       gl.nguon                                  AS nguon_gio,        -- NULL = giờ mặc định
       EXISTS (SELECT 1 FROM yeu_cau_gio y WHERE y.nhan_vien_id = sl.nhan_vien_id
               AND y.ngay_lam_viec = sl.ngay_lam_viec AND y.trang_thai = 'CHO') AS gio_cho_duyet,
       CASE WHEN COALESCE(gl.so_gio, gmd.so_gio) > 0
            THEN sl.phut_smv / (COALESCE(gl.so_gio, gmd.so_gio) * 60) * 100 END AS hieu_suat
FROM sl
LEFT JOIN LATERAL (SELECT chuyen_goc_ngay(sl.nhan_vien_id, sl.ngay_lam_viec) AS chuyen_goc_id) g ON TRUE
LEFT JOIN chuyen c ON c.id = g.chuyen_goc_id                     -- [D18] LEFT JOIN, không INNER
LEFT JOIN gio_lam gl ON gl.nhan_vien_id = sl.nhan_vien_id AND gl.ngay_lam_viec = sl.ngay_lam_viec
LEFT JOIN LATERAL (
  SELECT gm.so_gio FROM gio_mac_dinh gm
  WHERE gm.xuong_id = c.xuong_id AND gm.loai_ngay = loai_ngay(sl.ngay_lam_viec)
    AND gm.ap_dung_tu_ngay <= sl.ngay_lam_viec
  ORDER BY gm.ap_dung_tu_ngay DESC LIMIT 1) gmd ON TRUE;

-- Mức NV × chuyền × ngày: chia giờ làm cho từng chuyền theo tỷ lệ phút SMV [D15]
-- (thiếu SMV → chia theo tỷ lệ số sản phẩm). Dùng cho % hiệu suất chuyền (F5, F7).
CREATE VIEW v_nv_chuyen_ngay AS
WITH c AS (
  SELECT nhan_vien_id, ngay_lam_viec, chuyen_tram_snapshot AS chuyen_id,
         SUM(so_luong) AS san_luong_chuyen,
         SUM(so_luong * smv_snapshot) / 60.0 AS phut_smv_chuyen
  FROM san_luong GROUP BY 1, 2, 3)
SELECT c.*, n.gio_lam,
       n.gio_lam * 60 * CASE
         WHEN n.phut_smv > 0 AND NOT n.thieu_smv THEN c.phut_smv_chuyen / n.phut_smv
         ELSE c.san_luong_chuyen::numeric / NULLIF(n.tong_san_luong, 0)
       END AS phut_lam_phan_bo,
       n.thieu_smv
FROM c JOIN v_nv_ngay n USING (nhan_vien_id, ngay_lam_viec);
-- % hiệu suất chuyền = SUM(phut_smv_chuyen) / SUM(phut_lam_phan_bo) * 100

-- ═══ 2.7 Quyền tài khoản DB [D9] [TDD 6.4] ═══
-- Quyền mặc định (CRUD cho vsn_app, SELECT cho vsn_backup) do infra/postgres/init/01-tai-khoan.sh cấp.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log, san_luong_lich_su, lich_su_xuat_luong FROM vsn_app;
-- Lịch sử chuyền gốc chỉ do trigger (SECURITY DEFINER) ghi
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON nhan_vien_chuyen_goc FROM vsn_app;
-- View chỉ đọc
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON v_san_luong_chi_tiet, v_nv_ngay, v_nv_chuyen_ngay FROM vsn_app;
