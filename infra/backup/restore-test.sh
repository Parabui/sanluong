#!/bin/bash
# ════════════════════════════════════════════════════════════════
# Diễn tập khôi phục [TDD 15.1] [R 2.9] — chạy trong container TẠM (docker run --rm), private key do IT mang vào:
#   docker run --rm -v /srv/vsn/backups:/backups -v <thư mục chứa private key>:/khoa:ro \
#     [-e GPG_PASSPHRASE=…] vsn-backup restore-test.sh [/backups/vsn-….dump.gpg | moi-nhat | cloud] [/khoa/backup.priv.asc]
# Các bước: lấy bản backup (mới nhất trên server, hoặc tải từ cloud) → giải mã → khôi phục vào PostgreSQL TẠM trong container
#   → so số dòng các bảng chính với file .so-dong.txt (ghi cùng snapshot lúc backup) → ghi biên bản vào /backups/bien-ban/.
# Private key chỉ nằm trong GNUPGHOME tạm, xóa khi thoát; container --rm nên không còn gì sau diễn tập [D24].
# ════════════════════════════════════════════════════════════════
set -euo pipefail

NGUON=${1:-moi-nhat}
KHOA=${2:-/khoa/backup.priv.asc}
THU_MUC=${THU_MUC:-/backups}
LAM_VIEC=$(mktemp -d)
export GNUPGHOME="$LAM_VIEC/gnupg"
mkdir -m 700 "$GNUPGHOME"
PGDATA_TAM="$LAM_VIEC/pgdata"
batDau=$(date '+%F %T')

don() {
  su postgres -s /bin/sh -c "pg_ctl -D '$PGDATA_TAM' -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$LAM_VIEC"
}
trap don EXIT
log() { echo "[khoi-phuc $(date '+%T')] $*"; }

# ① Bản backup
case "$NGUON" in
  moi-nhat) FILE=$(ls -1t "$THU_MUC"/vsn-*.dump.gpg | head -n 1) ;;
  cloud)
    [ -n "${RCLONE_DICH:-}" ] || { echo "Thiếu RCLONE_DICH"; exit 2; }
    ten=$(rclone lsf "$RCLONE_DICH" --include 'vsn-*.dump.gpg' | sort | tail -n 1)
    rclone copy "$RCLONE_DICH/$ten" "$LAM_VIEC" && rclone copy "$RCLONE_DICH/${ten%.dump.gpg}.so-dong.txt" "$LAM_VIEC"
    FILE="$LAM_VIEC/$ten" ;;
  *) FILE=$NGUON ;;
esac
[ -r "$FILE" ] || { echo "Không đọc được $FILE"; exit 2; }
MANIFEST="${FILE%.dump.gpg}.so-dong.txt"
log "bản backup: $(basename "$FILE")"

# ② Giải mã bằng private key (không lưu lại)
gpg --batch --quiet --import "$KHOA"
gpg --batch --quiet --pinentry-mode loopback ${GPG_PASSPHRASE:+--passphrase "$GPG_PASSPHRASE"} --decrypt --output "$LAM_VIEC/vsn.dump" "$FILE"
log "đã giải mã ($(du -h "$LAM_VIEC/vsn.dump" | cut -f1))"

# ③ PostgreSQL tạm trong container + khôi phục
chown -R postgres "$LAM_VIEC"
su postgres -s /bin/sh -c "initdb -D '$PGDATA_TAM' -U postgres --auth=trust -E UTF8 --no-locale >/dev/null"
su postgres -s /bin/sh -c "pg_ctl -D '$PGDATA_TAM' -o \"-k $LAM_VIEC -c listen_addresses=''\" -w start >/dev/null"
export PGHOST=$LAM_VIEC PGUSER=postgres
createdb vsn_sanluong
psql -X -q -d vsn_sanluong -c "ALTER DATABASE vsn_sanluong SET timezone TO 'Asia/Ho_Chi_Minh'"
pg_restore --exit-on-error --no-owner --no-privileges -d vsn_sanluong "$LAM_VIEC/vsn.dump"
log "đã khôi phục"

# ④ Đối chiếu số dòng
ketQua=DAT; bang=""
if [ -r "$MANIFEST" ]; then
  while IFS='|' read -r ten soCu; do
    soMoi=$(psql -X -At -d vsn_sanluong -c "SELECT count(*) FROM $ten")
    trangThai=khớp
    [ "$soMoi" = "$soCu" ] || { trangThai=LỆCH; ketQua=KHONG_DAT; }
    bang+=$(printf '%-24s %10s %10s  %s\n' "$ten" "$soCu" "$soMoi" "$trangThai")$'\n'
  done < "$MANIFEST"
else
  ketQua=KHONG_DAT; bang="Không có file số dòng $(basename "$MANIFEST")"$'\n'
fi
migration=$(psql -X -At -d vsn_sanluong -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1")

# ⑤ Biên bản
mkdir -p "$THU_MUC/bien-ban"
BB="$THU_MUC/bien-ban/khoi-phuc-$(date +%Y%m%d-%H%M%S).txt"
{
  echo "BIÊN BẢN DIỄN TẬP KHÔI PHỤC — VSN Sản Lượng [R 2.9]"
  echo "Bắt đầu:         $batDau"
  echo "Kết thúc:        $(date '+%F %T')"
  echo "Bản backup:      $(basename "$FILE")  (nguồn: $NGUON)"
  echo "Migration cuối:  $migration"
  echo
  printf '%-24s %10s %10s  %s\n' "Bảng" "Lúc backup" "Khôi phục" "Kết quả"
  printf '%s' "$bang"
  echo
  echo "KẾT QUẢ: $([ "$ketQua" = DAT ] && echo 'ĐẠT — dữ liệu khôi phục đủ' || echo 'KHÔNG ĐẠT — xem các dòng LỆCH')"
  echo "Người thực hiện: ${NGUOI_THUC_HIEN:-(ghi tên)}"
} | tee "$BB"
log "biên bản: $BB"
[ "$ketQua" = DAT ]
