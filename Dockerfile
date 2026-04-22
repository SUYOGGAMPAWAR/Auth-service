# ── Stage 1: Dependencies ─────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app
COPY app/package*.json ./

RUN npm install --only=production && \
    cp -r node_modules node_modules_prod && \
    npm install

# ── Stage 2: Test ─────────────────────────────────────────────
FROM node:20-alpine AS test

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app/ .

ENV NODE_ENV=test
RUN npm run test:ci

# ── Stage 3: Production ───────────────────────────────────────
FROM node:20-alpine AS production

LABEL maintainer="devops-auth-service"
LABEL org.opencontainers.image.title="JWT Auth Service"
LABEL org.opencontainers.image.description="Production-grade JWT Authentication Microservice"

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=deps /app/node_modules_prod ./node_modules
COPY app/package*.json ./
COPY app/src ./src

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "src/index.js"]
