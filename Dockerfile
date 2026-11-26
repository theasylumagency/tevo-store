# Rodo / standard store — production image (Next.js standalone output).
# Store identity and public URL are baked into prerendered pages, so they are build arguments
# AND runtime env (docker-compose passes the same values to both).

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG STORE_ID=standard
ARG PUBLIC_BASE_URL=http://localhost:3000
ARG REVIEW_MODE=0
ENV STORE_ID=$STORE_ID PUBLIC_BASE_URL=$PUBLIC_BASE_URL REVIEW_MODE=$REVIEW_MODE \
    NEXT_TELEMETRY_DISABLED=1 DATABASE_URL=pglite:memory
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/data ./data
COPY --from=build --chown=node:node /app/drizzle ./drizzle
# product photos are mounted here (see docker-compose.yml); the image itself carries none
RUN mkdir -p public/media && chown node:node public/media
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
