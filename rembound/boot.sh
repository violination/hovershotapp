#!/bin/bash
set -Eeuo pipefail
umask 077
: "$LAB_PASSWORD"
if [ "$(printf %s "$LAB_PASSWORD" | wc -c)" -lt 16 ];then echo "LAB_PASSWORD_TOO_SHORT";exit 11;fi
printf 'test:%s\n' "$(openssl passwd -apr1 "$LAB_PASSWORD")" > /tmp/rembound_htpasswd
chgrp www-data /tmp/rembound_htpasswd
chmod 0640 /tmp/rembound_htpasswd
LAB_SMOKE_PASSWORD="$LAB_PASSWORD"
unset LAB_PASSWORD
rm -f /tmp/rembound-health.json
cd /opt/rembound
spacetime start --listen-addr 127.0.0.1:3002 > /tmp/rembound-stdb.log 2>&1 &
STDB_PID=$!
NEXT_PID=""
NGINX_PID=""
cleanup(){ set +u; kill "$STDB_PID" "$NEXT_PID" "$NGINX_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
READY=0
for n in $(seq 1 60);do
 if ! kill -0 "$STDB_PID" 2>/dev/null;then echo "SPACETIME_DB_EXITED";tail -n 55 /tmp/rembound-stdb.log;exit 15;fi
 STATUS="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3002/v1/database/gunbound/identity || true)"
 if [ "$STATUS" = "404" ] || [ "$STATUS" = "200" ];then READY=1;break;fi
 sleep 1
done
if [ "$READY" != "1" ];then echo "SPACETIME_START_TIMEOUT";tail -n 60 /tmp/rembound-stdb.log;exit 16;fi
if ! spacetime publish gunbound --server http://127.0.0.1:3002 --module-path server/spacetimedb --yes > /tmp/rembound-publish.log 2>&1;then
 echo "SPACETIME_MODULE_PUBLISH_FAILED";tail -n 100 /tmp/rembound-publish.log;exit 17
fi
echo "REMBOUND_MODULE_PUBLISHED"
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000 > /tmp/rembound-next.log 2>&1 &
NEXT_PID=$!
READY=0
for n in $(seq 1 55);do
 if ! kill -0 "$NEXT_PID" 2>/dev/null;then echo "REMBOUND_NEXT_EXITED";tail -n 65 /tmp/rembound-next.log;exit 18;fi
 STATUS="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3000/ || true)"
 if [ "$STATUS" = "200" ];then READY=1;break;fi
 sleep 1
done
if [ "$READY" != "1" ];then echo "REMBOUND_NEXT_TIMEOUT";tail -n 70 /tmp/rembound-next.log;exit 19;fi
nginx -t
nginx -g 'daemon off;' &
NGINX_PID=$!
ANON="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:10000/ || echo DOWN)"
AUTH="$(curl -s -o /dev/null -w '%{http_code}' --max-time 7 --user "test:$LAB_SMOKE_PASSWORD" http://127.0.0.1:10000/ || echo DOWN)"
unset LAB_SMOKE_PASSWORD
if [ "$ANON" != "401" ] || [ "$AUTH" != "200" ];then echo "REMBOUND_HTTP_SMOKE_FAILED anon=$ANON auth=$AUTH";exit 20;fi
WS="$(curl -s -i --max-time 3 -H 'Origin: https://rembound-lab-mvioli7.onrender.com' -H 'Upgrade: websocket' -H 'Connection: Upgrade' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Protocol: v1.json.spacetimedb' -H 'Sec-WebSocket-Key: SGVsbG9Xb3JsZDEyMzQ1Ng==' http://127.0.0.1:10000/v1/database/gunbound/subscribe 2>/dev/null | head -n 1 || true)"
case "$WS" in *" 101 "*)echo "REMBOUND_WSS_SMOKE_OK status=101";;*)echo "REMBOUND_WSS_SMOKE_FAILED $WS";exit 21;;esac
printf '%s\n' '{"status":"ok","application":"Rembound-lab","web":true,"spacetime":true}' >/tmp/rembound-health.json
chmod 0644 /tmp/rembound-health.json
echo "REMBOUND_LAB_READY port=10000"
while true;do
 if ! kill -0 "$NEXT_PID" 2>/dev/null;then echo "REMBOUND_NEXT_EXITED";tail -n 50 /tmp/rembound-next.log;exit 32;fi
 if ! kill -0 "$STDB_PID" 2>/dev/null;then echo "REMBOUND_STDB_EXITED";tail -n 50 /tmp/rembound-stdb.log;exit 33;fi
 if ! kill -0 "$NGINX_PID" 2>/dev/null;then echo "REMBOUND_NGINX_EXITED";exit 34;fi
 sleep 6
done
