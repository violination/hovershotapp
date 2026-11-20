FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends mariadb-server mariadb-client nginx curl git ca-certificates python3 openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/dragonbound
# Pin original upstream revision. Never mirror the 470 MB asset tree to the Hover Shot repo.
RUN git clone --quiet https://github.com/DragonBoundR/DragonBound.git . \
 && git checkout --detach --quiet 5e42cb4c6901b0ab16dcdb5dfd38474c7373b33a \
 && rm -rf .git \
 && npm ci --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force

COPY dragonboundre/prepare.py /tmp/dragonboundre_prepare.py
RUN python3 /tmp/dragonboundre_prepare.py \
 && rm /tmp/dragonboundre_prepare.py \
 && rm -f /opt/dragonbound/src/web/public_html/data/images/ava.rar

COPY dragonboundre/combined.cjs /opt/dragonbound/lab-combined.cjs
COPY dragonboundre/nginx.conf /etc/nginx/nginx.conf
COPY dragonboundre/boot.sh /usr/local/bin/dragonboundre-boot
RUN chmod 700 /usr/local/bin/dragonboundre-boot
ENV NODE_ENV=production WEB_PORT=8080
EXPOSE 10000
CMD ["/usr/local/bin/dragonboundre-boot"]
