FROM node:22-bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl git ca-certificates unzip nginx python3 openssl \
 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:/root/.local/bin:/root/.spacetimedb/bin:$PATH"
RUN curl -fsSL https://install.spacetimedb.com | sh -s -- --yes \
 && spacetime install 2.2.0 \
 && spacetime version use 2.2.0 \
 && spacetime --version && bun --version
WORKDIR /opt/rembound
RUN git clone --quiet https://github.com/remcostoeten/Gunbound.git . \
 && git checkout --detach --quiet 3e807036f444d006d89050c3f89802ed082d9115 \
 && rm -rf .git
COPY rembound/prepare.py /tmp/rembound-prepare.py
RUN python3 /tmp/rembound-prepare.py && rm -f /tmp/rembound-prepare.py \
 && bun install --frozen-lockfile \
 && spacetime build --module-path server/spacetimedb \
 && bun run build
COPY rembound/nginx.conf /etc/nginx/nginx.conf
COPY rembound/boot.sh /usr/local/bin/rembound-boot
RUN chmod 0700 /usr/local/bin/rembound-boot
ENV NODE_ENV=production NODE_OPTIONS="--max-old-space-size=192"
EXPOSE 10000
CMD ["/usr/local/bin/rembound-boot"]
