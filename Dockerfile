FROM node:22-alpine AS web-build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ORIGINALROOT_HOST=0.0.0.0 \
    ORIGINALROOT_PORT=8080 \
    ORIGINALROOT_DB_PATH=/data/originalroot.sqlite3
WORKDIR /app
COPY api ./api
COPY src/catalog.json ./src/catalog.json
COPY --from=web-build /app/dist ./dist
RUN useradd --system --uid 10001 --create-home originalroot \
    && mkdir -p /data \
    && chown -R originalroot:originalroot /app /data
USER originalroot
EXPOSE 8080
CMD ["python", "api/server.py"]
