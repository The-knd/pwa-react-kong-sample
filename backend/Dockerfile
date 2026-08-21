# syntax=docker/dockerfile:1
# Dockerfile parametrizado: un solo archivo construye los 4 microservicios.
#   docker build --build-arg SERVICE_NAME=auth-service .
ARG NODE_VERSION=22-alpine

# ── deps: capa cacheable, solo manifiestos ────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY common/package.json common/
COPY auth-service/package.json auth-service/
COPY users-service/package.json users-service/
COPY clients-service/package.json clients-service/
COPY sales-service/package.json sales-service/
RUN npm ci

# ── build: compila common + el servicio pedido y poda devDependencies ────
FROM deps AS build
ARG SERVICE_NAME
COPY tsconfig.base.json ./
COPY common/ common/
COPY ${SERVICE_NAME}/ ${SERVICE_NAME}/
RUN npm run build -w common \
 && npm run build -w "${SERVICE_NAME}" \
 && npm prune --omit=dev

# ── runtime: solo artefactos de producción, usuario sin privilegios ──────
FROM node:${NODE_VERSION} AS runtime
ARG SERVICE_NAME
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/common/package.json ./common/package.json
COPY --from=build --chown=node:node /app/common/dist ./common/dist
COPY --from=build --chown=node:node /app/${SERVICE_NAME}/package.json ./${SERVICE_NAME}/package.json
COPY --from=build --chown=node:node /app/${SERVICE_NAME}/dist ./${SERVICE_NAME}/dist
USER node
WORKDIR /app/${SERVICE_NAME}
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1
CMD ["node", "dist/main.js"]
