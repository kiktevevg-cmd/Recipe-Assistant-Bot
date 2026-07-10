FROM node:20-slim

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace-level config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy lib packages that api-server depends on
COPY lib/db/ ./lib/db/
COPY lib/api-zod/ ./lib/api-zod/
COPY lib/api-spec/ ./lib/api-spec/

# Copy the bot artifact
COPY artifacts/api-server/ ./artifacts/api-server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build the api-server
RUN pnpm --filter @workspace/api-server run build

# Run the bot
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
