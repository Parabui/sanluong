# Image vsn-backup [TDD 15.1] [D24]: pg_dump / pg_restore 17 + GPG + rclone + cron (busybox crond)
#   Backup 02:00 hằng ngày · kiểm tra ổ đĩa mỗi 5 phút · diễn tập khôi phục: chạy `restore-test.sh` trong container tạm (--rm)
# Build từ gốc repo: docker build -t vsn-backup infra/backup
FROM postgres:17-alpine

RUN apk add --no-cache bash gnupg rclone curl tzdata coreutils findutils
ENV TZ=Asia/Ho_Chi_Minh

COPY backup.sh kiem-tra-dia.sh restore-test.sh khoi-phuc.sh /usr/local/bin/
COPY crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/kiem-tra-dia.sh /usr/local/bin/restore-test.sh /usr/local/bin/khoi-phuc.sh \
 && mkdir -p /backups /keys /config/rclone

ENV RCLONE_CONFIG=/config/rclone/rclone.conf
VOLUME ["/backups"]

# Không dùng entrypoint của postgres (image này không chạy server DB)
ENTRYPOINT []
CMD ["crond", "-f", "-l", "6"]
