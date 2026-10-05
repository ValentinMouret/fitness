# syntax=docker/dockerfile:1.7

FROM postgres:18-alpine3.22@sha256:774521500f4c22761b25a6bdb772a0a3c2e8dd32468210bdad9231c5752ea398 AS postgres-tools

FROM oven/bun:1-alpine@sha256:819f91180e721ba09e0e5d3eb7fb985832fd23f516e18ddad7e55aaba8100be7 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts

FROM base AS prod-deps
COPY package.json bun.lock ./
RUN --mount=type=cache,id=bun,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --ignore-scripts

FROM deps AS build
ENV NODE_ENV=production
COPY . .
RUN bun run build

# Reuse prod-deps so node_modules stays in place — no costly cross-stage copy.
FROM prod-deps AS runtime

# Node is required to serve the app: Bun's react-dom/server.bun.js shim
# does not export renderToPipeableStream. Bun is kept for `bun db:migrate`.
RUN apk add --no-cache nodejs postgresql-client lz4-libs zstd-libs
COPY --from=postgres-tools /usr/local/bin/pg_dump /usr/local/bin/pg_restore /usr/local/bin/
RUN pg_dump --version && pg_restore --version

ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA
ENV NODE_ENV=production

COPY --from=build --chown=bun:bun /app/build              ./build
COPY --from=build --chown=bun:bun /app/server/request-logging.cjs ./server/request-logging.cjs
COPY --from=build --chown=bun:bun /app/drizzle            ./drizzle
COPY --from=build --chown=bun:bun /app/app/db/migrate.ts  ./app/db/migrate.ts
COPY --from=build --chown=bun:bun /app/app/env.server.ts  ./app/env.server.ts
COPY --from=build --chown=bun:bun /app/app/modules/auth/domain/oauth.ts ./app/modules/auth/domain/oauth.ts
COPY --from=build --chown=bun:bun /app/app/logger.server.ts ./app/logger.server.ts
COPY --from=build --chown=bun:bun /app/scripts/provision-mcp-reader.ts ./scripts/provision-mcp-reader.ts
COPY --from=build --chown=bun:bun /app/app/modules/mcp/infra/provision-reader.server.ts ./app/modules/mcp/infra/provision-reader.server.ts
COPY --from=build --chown=bun:bun /app/app/modules/mcp/domain/query-policy.ts ./app/modules/mcp/domain/query-policy.ts
COPY --chown=root:root deploy/preview-entrypoint.sh ./deploy/preview-entrypoint.sh
COPY --chown=root:root deploy/retained-entrypoint.sh deploy/publish-assets.ts ./deploy/
RUN chown root:root ./deploy && chmod 0755 ./deploy \
    && chmod 0555 ./deploy/retained-entrypoint.sh ./deploy/preview-entrypoint.sh \
    && chmod 0444 ./deploy/publish-assets.ts

ARG RETENTION_STARTUP_USER=bun
ARG RETAIN_PRODUCTION_ASSETS=false
ENV RETAIN_PRODUCTION_ASSETS=${RETAIN_PRODUCTION_ASSETS}
USER ${RETENTION_STARTUP_USER}

EXPOSE 5174

HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || '3000') + '/healthz').then(async r => { const v = await r.json(); if (!r.ok || v.status !== 'ok' || v.checks?.database !== 'ok') process.exit(1); }).catch(() => process.exit(1))"]

ENTRYPOINT ["./deploy/retained-entrypoint.sh"]
CMD ["node", "--require", "./server/request-logging.cjs", "./node_modules/.bin/react-router-serve", "./build/server/index.js"]
