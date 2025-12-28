FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM node:22-alpine AS runtime
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=build --chown=nodejs:nodejs /app/build ./build
COPY --from=build --chown=nodejs:nodejs /app/package.json ./
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/drizzle ./drizzle
COPY --from=build --chown=nodejs:nodejs /app/drizzle.config.ts ./
COPY --from=build --chown=nodejs:nodejs /app/app ./app
COPY --from=build --chown=nodejs:nodejs /app/tsconfig.json ./

USER nodejs

EXPOSE 5174

CMD ["npm", "run", "start"]
