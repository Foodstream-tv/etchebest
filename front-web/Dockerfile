# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

RUN corepack enable \
  && corepack prepare pnpm@9.15.5 --activate \
  && pnpm install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN pnpm run build && mkdir -p /app/public

FROM node:22-alpine

WORKDIR /app

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
