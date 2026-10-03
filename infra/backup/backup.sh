#!/bin/bash
# ════════════════════════════════════════════════════════════════
# Backup PostgreSQL [TDD 15.1] [D24]
#   pg_dump -Fc (tài khoản vsn_backup, chỉ đọc) → gpg --encrypt bằng PUBLIC key (server không giữ private key)
#   → /backups (giữ BACKUP_GIU bản, mặc định 30) → rclone copy lên cloud (giữ 30 ngày) → ping Uptime Kuma.
# Kèm file .so-dong.txt: số dòng các bảng chính ĐÚNG THỜI ĐIỂM của bản dump (cùng snapshot) — diễn tập khôi phục so với file này.
#
# Biến môi trường: PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD (libpq) · KHOA_CONG_KHAI (mặc định /keys/backup.pub.asc)
#   BACKUP_GIU · RCLONE_DICH (vd. onedrive:vsn-backup; trống = không đẩy cloud) · UPTIME_BACKUP_PUSH_URL (trống = không ping)
# ════════════════════════════════════════════════════════════════
set -euo pipefail

THU_MUC=${THU_MUC:-/backups}
GIU=${BACKUP_GIU:-30}
KHOA_CONG_KHAI=${KHOA_CONG_KHAI:-/keys/backup.pub.asc}
export PGDATABASE=${PGDATABASE:-vsn_sanluong}
# Bảng chính để đối chiếu khi khôi phục (đổi danh sách thì restore-test.sh tự theo — đọc từ file .so-dong.txt)
BANG="san_luong san_luong_lich_su nhan_vien nhan_vien_chuyen_goc tai_khoan ma_hang cong_doan smv_lich_su gan_cong_doan chot_ngay khoa_thang gio_lam yeu_cau_gio phien_tram audit_log"

log() { echo "[backup $(date '+%F %T')] $*"; }
loi() {
  log "LỖI: $*"
  [ -n "${UPTIME_BACKUP_PUSH_URL:-}" ] && curl -fsS -m 10 "${UPTIME_BACKUP_PUSH_URL}?status=down&msg=$(printf %s "$*" | head -c 200 | sed 's/ /%20/g')" >/dev/null || true
  exit 1
}
trap 'loi "dừng ở dòng $LINENO"' ERR

[ -r "$KHOA_CONG_KHAI" ] || loi "không đọc được public key $KHOA_CONG_KHAI"
mkdir -p "$THU_MUC"
ts=$(date +%Y%m%d-%H%M%S)
ten="vsn-$ts.dump.gpg"
tam="$THU_MUC/.dang-ghi-$ts"

# ① Giữ 1 transaction REPEATABLE READ mở, xuất snapshot → pg_dump và đếm số dòng cùng nhìn một trạng thái dữ liệu
coproc PSQL { psql -X -q -At -v ON_ERROR_STOP=1 2>&1; }
echo "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();" >&"${PSQL[1]}"
read -r -t 30 -u "${PSQL[0]}" snap || loi "không lấy được snapshot"
[[ "$snap" =~ ^[0-9A-F-]+$ ]] || loi "snapshot lạ: $snap"

sql=""
for b in $BANG; do sql+="SELECT '$b' || '|' || count(*) FROM $b UNION ALL "; done
echo "${sql% UNION ALL };" >&"${PSQL[1]}"
: > "$THU_MUC/vsn-$ts.so-dong.txt"
for _ in $BANG; do
  read -r -t 120 -u "${PSQL[0]}" dong || loi "không đếm được số dòng"
  echo "$dong" >> "$THU_MUC/vsn-$ts.so-dong.txt"
done

# ② Dump (định dạng custom) → mã hóa bằng public key — dữ liệu rõ không bao giờ chạm đĩa.
#    GIỮ owner + GRANT/REVOKE: khôi phục thật (khoi-phuc.sh) phải trả lại đúng phân quyền 3 tài khoản [D9] — thiếu thì vsn_app
#    mất quyền, audit_log mất chế độ chỉ-thêm. Diễn tập (restore-test.sh) tự bỏ owner/quyền khi khôi phục vào DB tạm.
pg_dump -Fc --snapshot="$snap" \
  | gpg --batch --yes --no-tty --trust-model always --recipient-file "$KHOA_CONG_KHAI" --encrypt --output "$tam"
echo "COMMIT;" >&"${PSQL[1]}"
exec {PSQL[1]}>&-
wait "$PSQL_PID" 2>/dev/null || true

[ -s "$tam" ] || loi "file backup rỗng"
mv "$tam" "$THU_MUC/$ten"
log "đã ghi $ten ($(du -h "$THU_MUC/$ten" | cut -f1))"

# ③ Giữ GIU bản mới nhất trên server
ls -1t "$THU_MUC"/vsn-*.dump.gpg | tail -n +$((GIU + 1)) | while read -r cu; do
  rm -f "$cu" "${cu%.dump.gpg}.so-dong.txt"
  log "xóa bản cũ $(basename "$cu")"
done

# ④ Cloud (OneDrive / Google Drive qua rclone) — giữ 30 ngày
if [ -n "${RCLONE_DICH:-}" ]; then
  rclone copy "$THU_MUC/$ten" "$RCLONE_DICH" --no-traverse
  rclone copy "$THU_MUC/vsn-$ts.so-dong.txt" "$RCLONE_DICH" --no-traverse
  rclone delete "$RCLONE_DICH" --min-age 30d --include 'vsn-*'
  log "đã đẩy lên $RCLONE_DICH"
fi

# ⑤ Báo "còn sống" cho Uptime Kuma (push monitor) — chỉ khi mọi bước trên thành công
if [ -n "${UPTIME_BACKUP_PUSH_URL:-}" ]; then
  curl -fsS -m 10 "${UPTIME_BACKUP_PUSH_URL}?status=up&msg=OK" >/dev/null || log "không ping được Uptime Kuma"
fi
log "xong"
