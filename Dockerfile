# syntax=docker/dockerfile:1
FROM node:24-slim AS build
WORKDIR /app
RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt/lists \
    apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json yarn.lock .yarnrc.yml ./
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    corepack enable && yarn install --immutable
COPY . .
RUN corepack enable && yarn build
RUN --mount=type=cache,target=/root/.yarn/berry/cache \
    corepack enable && yarn workspaces focus --production

FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV COREPACK_HOME=/usr/local/share/corepack
WORKDIR /app
RUN mkdir -p /app/data /app/uploads /app/.yarn && chown -R node:node /app
RUN corepack enable && corepack prepare yarn@4.15.0 --activate && chown -R node:node "$COREPACK_HOME"
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=build /app/yarn.lock ./yarn.lock
COPY --chown=node:node --from=build /app/.yarnrc.yml ./.yarnrc.yml
COPY --chown=node:node --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --chown=node:node --from=build /app/drizzle ./drizzle
COPY --chown=node:node --from=build /app/src/data/database/schema ./src/data/database/schema
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/src/Main.js"]
