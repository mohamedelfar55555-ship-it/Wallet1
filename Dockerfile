FROM node:22-slim

WORKDIR /app

# Install dependencies cleanly using package.json (supports npm or lockfiles)
COPY package.json bun.lock* package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi

COPY . .
RUN npm run build

# Persist SQLite directory (mount Cloud Run volume at /app/data in production)
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=8080
ENV WALLET_DB_PATH=/app/data/demo_wallet.db

EXPOSE 8080

CMD ["node", "server.ts"]
