# syntax=docker/dockerfile:1.7

# ---- Builder: install deps and build the Vite static bundle ----
FROM node:20-alpine AS builder

WORKDIR /app

# VITE_* vars are baked in at build time — pass via --build-arg if overriding.
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Install deps first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js index.html ./
COPY src ./src

RUN npm run build


# ---- Runtime: nginx serving the static bundle on port 3000 ----
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1
