# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=20-bookworm-slim

# -------- base --------
FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
ENV PNPM_HOME="/pnpm" PATH="$PNPM_HOME:$PATH" CI=true

# -------- deps --------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml* package.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/logger/package.json packages/logger/
COPY packages/types/package.json packages/types/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# -------- build --------
FROM deps AS build
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @jobpilot/db generate
RUN pnpm --filter @jobpilot/api build
RUN pnpm --filter @jobpilot/api deploy --prod /out

# -------- runtime --------
FROM mcr.microsoft.com/playwright:v1.60.0-noble AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/packages/db/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json
EXPOSE 4000
USER pwuser
CMD ["node", "dist/server.js"]
