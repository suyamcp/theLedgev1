# The Ledge — production image.
# Works as-is on Render, Railway, Fly.io, Google Cloud Run, or plain Docker.

# ---- build stage: install everything, compile client + server ----
FROM node:22-slim AS build
WORKDIR /app

# Install with the lockfile so builds are reproducible. Dev dependencies are
# needed here because the build itself runs tsc/vite/esbuild.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Drop dev dependencies so only runtime packages are copied forward.
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as the unprivileged user the base image already provides.
USER node

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

# The server reads process.env.PORT; hosts that inject their own will override this.
ENV PORT=3000
EXPOSE 3000

# The platform's own health check should target /healthz.
CMD ["node", "dist/server.cjs"]
