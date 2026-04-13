FROM oven/bun:1-alpine@sha256:819f91180e721ba09e0e5d3eb7fb985832fd23f516e18ddad7e55aaba8100be7 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY . .
RUN bun run build

FROM oven/bun:1-alpine@sha256:819f91180e721ba09e0e5d3eb7fb985832fd23f516e18ddad7e55aaba8100be7 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-alpine@sha256:819f91180e721ba09e0e5d3eb7fb985832fd23f516e18ddad7e55aaba8100be7 AS runtime
WORKDIR /app

COPY --from=build --chown=bun:bun /app/build ./build
COPY --from=build --chown=bun:bun /app/package.json ./
COPY --from=prod-deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/drizzle ./drizzle
COPY --from=build --chown=bun:bun /app/app/db/migrate.ts ./app/db/migrate.ts
COPY --from=build --chown=bun:bun /app/app/env.server.ts ./app/env.server.ts
COPY --from=build --chown=bun:bun /app/app/logger.server.ts ./app/logger.server.ts

USER bun

EXPOSE 5174

CMD ["bun", "run", "start"]
