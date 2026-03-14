FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy source
COPY . .

# Create logs directory
RUN mkdir -p server/logs

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server/index.js"]
