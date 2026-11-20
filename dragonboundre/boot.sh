#!/bin/bash
set -Eeuo pipefail
umask 077
export NODE_OPTIONS="--max-old-space-size=112"
export WEB_PORT=8080
export DB_HOST=127.0.0.1
export DB_PORT=3306
export DB_USER=drblab
export DB_DATABASE=dragonbound
export DB_PASSWORD="$(openssl rand -hex 18)"
export COOKIE_SECRET="$(openssl rand -hex 24)"
export SESSION_SECRET="$(openssl rand -hex 24)"
: "${LAB_PASSWORD:?LAB_PASSWORD must be configured on Render}"
if [ "${#LAB_PASSWORD}" -lt 16 ]; then echo 'LAB_PASSWORD_TOO_SHORT'; exit 30; fi
printf 'test:%s\n' "$(openssl passwd -apr1 "${LAB_PASSWORD}")" > /tmp/dragonboundre_htpasswd
unset LAB_PASSWORD
mkdir -p /run/mysqld /tmp/dragonbound-db
chown -R mysql:mysql /run/mysqld /tmp/dragonbound-db
mariadb-install-db --datadir=/tmp/dragonbound-db --user=mysql --skip-test-db --auth-root-authentication-method=normal >/dev/null
mariadbd --user=mysql --datadir=/tmp/dragonbound-db --socket=/run/mysqld/mysqld.sock --pid-file=/run/mysqld/mysqld.pid --bind-address=127.0.0.1 --port=3306 --performance-schema=OFF --skip-log-bin --innodb-buffer-pool-size=32M --max-connections=25 --table-open-cache=64 --key-buffer-size=8M --log-error=/tmp/dragonbound-db/mariadb.log &
DB_PID=$!
for n in $(seq 1 120); do
  if mariadb --socket=/run/mysqld/mysqld.sock -uroot -e 'SELECT 1' >/dev/null 2>&1; then break; fi
  if ! kill -0 "$DB_PID" 2>/dev/null; then echo 'DATABASE_EXITED'; cat /tmp/dragonbound-db/mariadb.log || true; exit 31; fi
  sleep 1
done
mariadb --socket=/run/mysqld/mysqld.sock -uroot -e 'CREATE DATABASE dragonbound CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
mariadb --socket=/run/mysqld/mysqld.sock -uroot -e "CREATE USER 'drblab'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}'; GRANT ALL PRIVILEGES ON dragonbound.* TO 'drblab'@'127.0.0.1'; FLUSH PRIVILEGES;"
if ! mariadb --socket=/run/mysqld/mysqld.sock -uroot dragonbound < /opt/dragonbound/database/seed-sanitized.sql; then
 echo 'SQL_INIT_FAILED'; exit 32
fi
rm -f /opt/dragonbound/database/seed-sanitized.sql
echo 'DATABASE_SANITIZED_INITIALIZED'
cd /opt/dragonbound
npm run start:game > /tmp/dbre-game.log 2>&1 &
GAME_PID=$!
npm run start:web > /tmp/dbre-web.log 2>&1 &
WEB_PID=$!
nginx -t
nginx -g 'daemon off;' &
NGINX_PID=$!
echo 'DRAGONBOUNDRE_LAB_PROXY_READY port=10000'
trap 'kill "$GAME_PID" "$WEB_PID" "$NGINX_PID" "$DB_PID" 2>/dev/null || true' EXIT INT TERM
while true; do
 if ! kill -0 "$NGINX_PID" 2>/dev/null; then echo 'NGINX_EXITED'; exit 41; fi
 if ! kill -0 "$WEB_PID" 2>/dev/null; then echo 'WEB_EXITED'; tail -n 60 /tmp/dbre-web.log; exit 42; fi
 if ! kill -0 "$GAME_PID" 2>/dev/null; then echo 'GAME_EXITED'; tail -n 60 /tmp/dbre-game.log; exit 43; fi
 sleep 5
done
