# ==========================================
# Stage 1: Build stage
# ==========================================
FROM node:24-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source and build TypeScript
COPY src/ ./src/
RUN npm run build

# ==========================================
# Stage 2: Production runtime stage
# ==========================================
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7000
ENV HOST=0.0.0.0

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY public/ ./public/

# Setup persistent data directory for cache & logs
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 7000

# Docker health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:7000/health || exit 1

CMD ["node", "dist/index.js"]
