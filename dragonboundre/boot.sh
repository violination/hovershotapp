#!/bin/bash
set -Eeuo pipefail
umask 077
export NODE_OPTIONS="--max-old-space-size=200"
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
# Nginx workers are www-data, while this file is created by root with umask 077.
# Grant read permission only to that group; never make the password file public.
chgrp www-data /tmp/dragonboundre_htpasswd
chmod 0640 /tmp/dragonboundre_htpasswd
LAB_SMOKE_PASSWORD="${LAB_PASSWORD}"
unset LAB_PASSWORD
# Every instance/restart is a disposable lab, never reuse partially imported state.
rm -rf /tmp/dragonbound-db
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
node /opt/dragonbound/lab-combined.cjs > /tmp/dbre-combined.log 2>&1 &
APP_PID=$!
trap 'kill "$APP_PID" "${NGINX_PID:-}" "$DB_PID" 2>/dev/null || true' EXIT INT TERM
# Publish proxy early to avoid Render port-scan timeout. Health remains 404
# until both upstream servers answer successfully; public UI remains BasicAuth-gated.
rm -f /tmp/dragonboundre-health.json
nginx -t
nginx -g 'daemon off;' &
NGINX_PID=$!
echo 'DRAGONBOUNDRE_PROXY_STARTING port=10000'
READY=0
for n in $(seq 1 40); do
 if ! kill -0 "$APP_PID" 2>/dev/null; then echo 'APP_EXITED'; tail -n 100 /tmp/dbre-combined.log; exit 43; fi
 WEB_STATUS="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 1 --max-time 2 http://127.0.0.1:8080/ || echo DOWN)"
 GAME_STATUS="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 1 --max-time 2 http://127.0.0.1:9001/ || echo DOWN)"
 PROBE="web=$WEB_STATUS game=$GAME_STATUS"
 PROBE_OK=0
 if [ "$WEB_STATUS" = "200" ] && [ "$GAME_STATUS" = "200" ]; then PROBE_OK=1; fi
 if [ "$PROBE_OK" -eq 1 ]; then
   READY=1
   echo "DRAGONBOUNDRE_UPSTREAMS_OK $PROBE"
   break
 fi
 if [ "$n" -eq 1 ] || [ "$n" -eq 5 ] || [ "$n" -eq 10 ] || [ "$n" -eq 20 ] || [ "$n" -eq 30 ]; then
   echo "DRAGONBOUNDRE_PROBE n=$n $PROBE"
   tail -n 12 /tmp/dbre-combined.log | sed 's/^/APP: /'
 fi
 sleep 2
done
if [ "$READY" -ne 1 ]; then
 echo 'UPSTREAM_SMOKE_FAILED'
 echo '==== COMBINED LOG ===='; tail -n 100 /tmp/dbre-combined.log
 exit 44
fi
# End-to-end local checks MUST pass before advertising readiness. Previous
# deployment only probed unprotected upstreams, so a bad htpasswd chmod
# produced HTTP 500 for every authenticated human browser request.
ANON_CODE="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 6 http://127.0.0.1:10000/ || echo DOWN)"
AUTH_CODE="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 8 --user "test:${LAB_SMOKE_PASSWORD}" http://127.0.0.1:10000/ || echo DOWN)"
STATIC_CODE="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 8 --user "test:${LAB_SMOKE_PASSWORD}" http://127.0.0.1:10000/static/css/ThorBound.min.css || echo DOWN)"
unset LAB_SMOKE_PASSWORD
if [ "$ANON_CODE" != "401" ] || [ "$AUTH_CODE" != "200" ] || [ "$STATIC_CODE" != "200" ]; then
  echo "AUTHENTICATED_HTTP_SMOKE_FAILED anonymous=$ANON_CODE authenticated=$AUTH_CODE static=$STATIC_CODE"
  exit 46
fi
echo "AUTHENTICATED_HTTP_SMOKE_OK anonymous=401 authenticated=200 static=200"
printf '%s\n' '{"status":"ok","mode":"dragonboundre-lab","web":true,"game":true}' > /tmp/dragonboundre-health.json
chmod 644 /tmp/dragonboundre-health.json
echo 'DRAGONBOUNDRE_LAB_READY web=200 game=200 port=10000'
while true; do
 if ! kill -0 "$NGINX_PID" 2>/dev/null; then echo 'NGINX_EXITED'; exit 41; fi
 if ! kill -0 "$APP_PID" 2>/dev/null; then echo 'APP_EXITED'; tail -n 70 /tmp/dbre-combined.log; exit 43; fi
 sleep 5
done
