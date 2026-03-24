FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy source and build
COPY . .
RUN npm run build

# Create data directory for persistent storage
RUN mkdir -p /data

# Environment
ENV NODE_ENV=production
ENV PORT=5000
ENV DATABASE_PATH=/data/training.db

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
