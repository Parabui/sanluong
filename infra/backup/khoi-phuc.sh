#!/bin/bash
# ════════════════════════════════════════════════════════════════
# KHÔI PHỤC THẬT vào DB production đang chạy [TDD 18 — RUNBOOK "Khôi phục từ backup"]. Khác restore-test.sh (chỉ khôi phục
# vào DB tạm để diễn tập): script này GHI ĐÈ toàn bộ dữ liệu hiện tại. Phải dừng api trước. Chạy qua compose:
#   docker compose -f infra/compose.prod.yml --env-file .env stop api
#   docker compose -f infra/compose.prod.yml --env-file .env run --rm --no-deps -e POSTGRES_PASSWORD \
#     [-v <thư mục private key>:/khoa:ro] backup khoi-phuc.sh <nguồn> [/khoa/backup.key.asc]
# <nguồn>: moi-nhat (bản mã hóa mới nhất trên server) · cloud (bản mới nhất trên cloud) · đường dẫn 1 file trong /backups:
#   …/vsn-*.dump.gpg (cần private key) hoặc …/truoc-deploy/truoc-deploy-*.dump (không mã hóa, không cần key).
# Các bước: lấy + giải mã → dump AN TOÀN DB hiện tại (/backups/truoc-khoi-phuc/) → hỏi xác nhận (gõ KHOI PHUC, hoặc
#   XAC_NHAN=KHOI_PHUC) → pg_restore --clean trong 1 transaction (lỗi giữa chừng = không đổi gì) → in số dòng bảng chính.
# Kết nối bằng superuser `postgres` (POSTGRES_PASSWORD) — vsn_backup chỉ có quyền đọc.
# ════════════════════════════════════════════════════════════════
set -euo pipefail

NGUON=${1:?Dùng: khoi-phuc.sh <moi-nhat|cloud|/backups/…> [/khoa/backup.key.asc]}
KHOA=${2:-/khoa/backup.key.asc}
THU_MUC=${THU_MUC:-/backups}
: "${POSTGRES_PASSWORD:?Thiếu POSTGRES_PASSWORD (chạy kèm -e POSTGRES_PASSWORD)}"
export PGHOST=${PGHOST:-postgres} PGUSER=postgres PGPASSWORD=$POSTGRES_PASSWORD PGDATABASE=${PGDATABASE:-vsn_sanluong}
LAM_VIEC=$(mktemp -d)
export GNUPGHOME="$LAM_VIEC/gnupg"
mkdir -m 700 "$GNUPGHOME"
trap 'rm -rf "$LAM_VIEC"' EXIT
log() { echo "[khoi-phuc $(date '+%F %T')] $*"; }

# ① Bản cần khôi phục
case "$NGUON" in
  moi-nhat) FILE=$(ls -1t "$THU_MUC"/vsn-*.dump.gpg | head -n 1) ;;
  cloud)
    [ -n "${RCLONE_DICH:-}" ] || { echo "Thiếu RCLONE_DICH"; exit 2; }
    ten=$(rclone lsf "$RCLONE_DICH" --include 'vsn-*.dump.gpg' | sort | tail -n 1)
    rclone copy "$RCLONE_DICH/$ten" "$LAM_VIEC"
    FILE="$LAM_VIEC/$ten" ;;
  *) FILE=$NGUON ;;
esac
[ -r "$FILE" ] || { echo "Không đọc được $FILE"; exit 2; }
log "bản khôi phục: $FILE"
if [[ "$FILE" == *.gpg ]]; then
  [ -r "$KHOA" ] || { echo "Bản mã hóa cần private key: mount thư mục chứa key vào /khoa (xem RUNBOOK)"; exit 2; }
  gpg --batch --quiet --import "$KHOA"
  gpg --batch --quiet --pinentry-mode loopback ${GPG_PASSPHRASE:+--passphrase "$GPG_PASSPHRASE"} --decrypt --output "$LAM_VIEC/vsn.dump" "$FILE"
  DUMP="$LAM_VIEC/vsn.dump"
else
  DUMP="$FILE"
fi
pg_restore --list "$DUMP" >/dev/null || { echo "File không phải dump hợp lệ"; exit 2; }
log "đọc được dump ($(du -h "$DUMP" | cut -f1))"

# ② API phải dừng — còn kết nối của vsn_app nghĩa là đang có người ghi
dang_ket_noi=$(psql -X -At -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND usename = 'vsn_app'")
[ "$dang_ket_noi" = 0 ] || { echo "API vẫn đang kết nối ($dang_ket_noi kết nối vsn_app) — chạy 'docker compose … stop api' trước"; exit 2; }

# ③ Dump an toàn bản hiện tại (để quay lại nếu khôi phục nhầm)
mkdir -p "$THU_MUC/truoc-khoi-phuc"
AN_TOAN="$THU_MUC/truoc-khoi-phuc/truoc-khoi-phuc-$(date +%Y%m%d-%H%M%S).dump"
( umask 077; pg_dump -Fc -f "$AN_TOAN" )
log "đã lưu bản hiện tại: $AN_TOAN"

# ④ Xác nhận
if [ "${XAC_NHAN:-}" != "KHOI_PHUC" ]; then
  [ -t 0 ] || { echo "Cần xác nhận: chạy với -it, hoặc -e XAC_NHAN=KHOI_PHUC"; exit 2; }
  read -rp "GHI ĐÈ toàn bộ dữ liệu bằng $(basename "$FILE")? Gõ KHOI PHUC để tiếp tục: " tl
  [ "$tl" = "KHOI PHUC" ] || { log "đã hủy — không thay đổi gì"; exit 1; }
fi

# ⑤ Khôi phục trong 1 transaction (giữ owner + quyền: vsn_migrate sở hữu, vsn_app CRUD, audit chỉ INSERT/SELECT)
pg_restore --clean --if-exists --single-transaction --exit-on-error -d "$PGDATABASE" "$DUMP"
log "ĐÃ KHÔI PHỤC"

# ⑥ Phân quyền sau khôi phục phải đúng như migration đặt [D9] — sai thì API không chạy được / audit sửa được
quyen=$(psql -X -At -c "SELECT (SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'san_luong') = 'vsn_migrate'
  AND has_table_privilege('vsn_app', 'san_luong', 'INSERT') AND has_table_privilege('vsn_app', 'audit_log', 'INSERT')
  AND NOT has_table_privilege('vsn_app', 'audit_log', 'UPDATE') AND NOT has_table_privilege('vsn_app', 'audit_log', 'DELETE')
  AND has_table_privilege('vsn_backup', 'san_luong', 'SELECT')")
if [ "$quyen" != "t" ]; then
  log "⚠ PHÂN QUYỀN SAU KHÔI PHỤC KHÔNG ĐÚNG (bản backup thiếu GRANT?) — KHÔNG mở api. Khôi phục lại bằng bản an toàn: $AN_TOAN"
  exit 3
fi
log "phân quyền đúng: owner vsn_migrate · vsn_app CRUD · audit chỉ thêm · vsn_backup chỉ đọc"
for b in san_luong san_luong_lich_su chot_ngay khoa_thang nhan_vien tai_khoan audit_log; do
  printf '  %-22s %s\n' "$b" "$(psql -X -At -c "SELECT count(*) FROM $b")"
done
printf '  %-22s %s\n' "migration cuối" "$(psql -X -At -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1")"
# Chuyển máy (chuyen-may.sh) không mất số nào → không nhắc nhập lại
[ "${NGU_CANH:-}" = chuyen-may ] || log "Tiếp theo: docker compose … up -d api → đăng nhập kiểm tra → báo tổ trưởng nhập lại số từ thời điểm của bản backup"
