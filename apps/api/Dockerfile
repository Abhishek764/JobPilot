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
COPY turbo.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @jobpilot/db generate
# Builds @jobpilot/{types,logger,db} to dist/ first, then the API.
RUN pnpm turbo run build --filter=@jobpilot/api
RUN pnpm --filter @jobpilot/api deploy --prod /out
# Generate the Prisma client inside the deployed node_modules (pnpm deploy reinstalls without it).
RUN cp -r packages/db/prisma /out/prisma  && cd /out && /repo/packages/db/node_modules/.bin/prisma generate --schema=prisma/schema.prisma

# -------- runtime --------
FROM mcr.microsoft.com/playwright:v1.48.2-noble AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /out/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json
EXPOSE 4000
USER pwuser
CMD ["node", "dist/server.js"]
