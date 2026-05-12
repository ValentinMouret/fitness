# syntax=docker/dockerfile:1.7

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
RUN apk add --no-cache nodejs postgresql-client

ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA
ENV NODE_ENV=production

COPY --from=build --chown=bun:bun /app/build              ./build
COPY --from=build --chown=bun:bun /app/drizzle            ./drizzle
COPY --from=build --chown=bun:bun /app/app/db/migrate.ts  ./app/db/migrate.ts
COPY --from=build --chown=bun:bun /app/app/env.server.ts  ./app/env.server.ts
COPY --from=build --chown=bun:bun /app/app/logger.server.ts ./app/logger.server.ts
COPY --chown=bun:bun deploy/preview-entrypoint.sh ./deploy/preview-entrypoint.sh

USER bun

EXPOSE 5174

ENTRYPOINT ["./deploy/preview-entrypoint.sh"]
CMD ["node", "./node_modules/.bin/react-router-serve", "./build/server/index.js"]
