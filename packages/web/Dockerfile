FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Make INTERNAL_API_URL available at build time so next.config.ts rewrites
# bake in the correct container-to-container URL (not localhost).
ARG INTERNAL_API_URL=http://api:5005
ENV INTERNAL_API_URL=$INTERNAL_API_URL

RUN bun run build

FROM oven/bun:1 AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3080

ENV PORT=3080
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]
