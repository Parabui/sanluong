#!/bin/bash
# Ổ đĩa ≥ NGUONG_DIA (mặc định 80%) → push monitor Uptime Kuma báo "down" [TDD 18]. Chạy mỗi 5 phút (crontab).
# Đo phân vùng gốc (overlay = ổ của server) và /backups.
set -euo pipefail
NGUONG=${NGUONG_DIA:-80}
[ -n "${UPTIME_DISK_PUSH_URL:-}" ] || exit 0

cao=0; ghi=""
for p in / /backups; do
  dung=$(df -P "$p" | awk 'NR==2 { gsub("%", "", $5); print $5 }')
  ghi+="${p}:${dung}% "
  [ "$dung" -gt "$cao" ] && cao=$dung
done
trangThai=up
[ "$cao" -ge "$NGUONG" ] && trangThai=down
curl -fsS -m 10 "${UPTIME_DISK_PUSH_URL}?status=${trangThai}&msg=$(printf %s "$ghi" | sed 's/ /%20/g;s/%20$//')&ping=${cao}" >/dev/null || true
