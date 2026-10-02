#!/bin/bash
# ════════════════════════════════════════════════════════════════
# Chạy MỘT lần khi volume pgdata còn trống (docker-entrypoint-initdb.d).
# Tạo 3 tài khoản tách quyền [D9] [TDD 6.4]:
#   vsn_migrate — chủ schema public, có DDL (bước migrate)
#   vsn_app     — CRUD bảng nghiệp vụ, KHÔNG DDL (API lúc chạy)
#   vsn_backup  — chỉ đọc (container backup)
# Quyền chỉ INSERT/SELECT trên audit_log, san_luong_lich_su, lich_su_xuat_luong
# được REVOKE ngay trong migration tạo các bảng đó.
# ════════════════════════════════════════════════════════════════
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v db="$POSTGRES_DB" \
  -v app_pw="$VSN_APP_PASSWORD" \
  -v migrate_pw="$VSN_MIGRATE_PASSWORD" \
  -v backup_pw="$VSN_BACKUP_PASSWORD" \
  -v migrate_createdb="${VSN_MIGRATE_CREATEDB:-false}" <<-'EOSQL'
	CREATE ROLE vsn_migrate LOGIN PASSWORD :'migrate_pw';
	CREATE ROLE vsn_app     LOGIN PASSWORD :'app_pw';
	CREATE ROLE vsn_backup  LOGIN PASSWORD :'backup_pw';

	-- Dev: `prisma migrate dev` cần tạo shadow database
	SELECT :'migrate_createdb'::boolean AS cho_createdb \gset
	\if :cho_createdb
	  ALTER ROLE vsn_migrate CREATEDB;
	\endif

	ALTER DATABASE :"db" SET timezone TO 'Asia/Ho_Chi_Minh';
	CREATE EXTENSION IF NOT EXISTS btree_gist;

	ALTER SCHEMA public OWNER TO vsn_migrate;
	REVOKE CREATE ON SCHEMA public FROM PUBLIC;
	GRANT USAGE ON SCHEMA public TO vsn_app, vsn_backup;

	-- Bảng / sequence do vsn_migrate tạo về sau tự cấp quyền
	ALTER DEFAULT PRIVILEGES FOR ROLE vsn_migrate IN SCHEMA public
	  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vsn_app;
	ALTER DEFAULT PRIVILEGES FOR ROLE vsn_migrate IN SCHEMA public
	  GRANT USAGE, SELECT ON SEQUENCES TO vsn_app;
	ALTER DEFAULT PRIVILEGES FOR ROLE vsn_migrate IN SCHEMA public
	  GRANT SELECT ON TABLES TO vsn_backup;
	ALTER DEFAULT PRIVILEGES FOR ROLE vsn_migrate IN SCHEMA public
	  GRANT SELECT ON SEQUENCES TO vsn_backup;
EOSQL
