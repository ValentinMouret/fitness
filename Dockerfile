FROM oven/bun:1-alpine@sha256:819f91180e721ba09e0e5d3eb7fb985832fd23f516e18ddad7e55aaba8100be7 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

FROM deps AS build
WORKDIR /app
COPY . .
RUN bun run build

FROM oven/bun:1-alpine@sha256:819f91180e721ba09e0e5d3eb7fb985832fd23f516e18ddad7e55aaba8100be7 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts

FROM oven/bun:1-alpine@sha256:819f91180e721ba09e0e5d3eb7fb985832fd23f516e18ddad7e55aaba8100be7 AS runtime
WORKDIR /app

# Node is required to serve the app: Bun's react-dom/server.bun.js shim
# does not export renderToPipeableStream. Bun is kept for `bun db:migrate`.
RUN apk add --no-cache nodejs

ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

COPY --from=build --chown=bun:bun /app/build ./build
COPY --from=build --chown=bun:bun /app/package.json ./
COPY --from=prod-deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/drizzle ./drizzle
COPY --from=build --chown=bun:bun /app/app/db/migrate.ts ./app/db/migrate.ts
COPY --from=build --chown=bun:bun /app/app/env.server.ts ./app/env.server.ts
COPY --from=build --chown=bun:bun /app/app/logger.server.ts ./app/logger.server.ts

USER bun

EXPOSE 5174

CMD ["node", "./node_modules/.bin/react-router-serve", "./build/server/index.js"]
