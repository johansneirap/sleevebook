FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@2.11.8
COPY . .
RUN turbo prune @sleevebook/web --docker

FROM base AS installer
WORKDIR /app
RUN npm install -g pnpm@10.29.2
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
# next build evaluates route modules (e.g. /api/health -> src/env.ts) to collect
# page data; these placeholders only satisfy that build-time pass and never
# reach the runner stage. Railway injects the real values at container start.
ENV DATABASE_URL=postgres://build:build@localhost:5432/build \
    S3_ENDPOINT=http://localhost \
    S3_BUCKET=build \
    S3_ACCESS_KEY_ID=build \
    S3_SECRET_ACCESS_KEY=build \
    PUBLIC_ASSETS_URL=http://localhost \
    BETTER_AUTH_SECRET=build-time-placeholder \
    BETTER_AUTH_URL=http://localhost:3000
RUN pnpm --filter=@sleevebook/web run build

# Next's standalone trace bundles drizzle-orm straight into the server code
# (pure JS, no native bindings), so it never shows up as its own node_modules
# entry there. The migration step runs as a separate process, so it needs its
# own self-contained copy of @sleevebook/db with real (non-symlinked) deps.
RUN pnpm --filter=@sleevebook/db deploy --prod --legacy /app/deploy-db

FROM base AS runner
WORKDIR /app
RUN npm install -g pnpm@10.29.2
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/deploy-db ./db-migrate

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Railway's Pre-Deploy Command runs, against this same image, before traffic
# switches over: pnpm --dir db-migrate run migrate:apply
CMD ["node", "apps/web/server.js"]
