# Cloud Run image for the GGG Steam Intelligence app.
#
# Uses Next.js `output: 'standalone'` so the runtime stage carries only the server
# bundle and its traced dependencies. No credentials are baked into the image:
# BigQuery configuration arrives as Cloud Run environment variables / the service
# account attached to the revision, and stays server-side.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Run unprivileged.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Cloud Run injects PORT; the standalone server reads it.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080

CMD ["node", "server.js"]
