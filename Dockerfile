# Multi-stage Dockerfile for all microservices
FROM node:20-alpine AS base

WORKDIR /app

# Copy all package.json files
COPY package*.json ./
COPY apps/api-gateway/package*.json ./apps/api-gateway/
COPY apps/user-service/package*.json ./apps/user-service/
COPY apps/email-service/package*.json ./apps/email-service/
COPY apps/push-service/package*.json ./apps/push-service/
COPY apps/template-service/package*.json ./apps/template-service/

# Install all dependencies (workspace install)
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY apps/ ./apps/

# Build API Gateway
FROM base AS api-gateway
WORKDIR /app/apps/api-gateway
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]

# Build User Service
FROM base AS user-service
WORKDIR /app/apps/user-service
RUN npm run build
EXPOSE 4000
CMD ["npm", "run", "start:prod"]

# Build Email Service
FROM base AS email-service
WORKDIR /app/apps/email-service
RUN npm run build
EXPOSE 3001
CMD ["npm", "run", "start:prod"]

# Build Push Service
FROM base AS push-service
WORKDIR /app/apps/push-service
RUN npm run build
EXPOSE 3002
CMD ["npm", "run", "start:prod"]

# Build Template Service
FROM base AS template-service
WORKDIR /app/apps/template-service
RUN npm run build
EXPOSE 3004
CMD ["npm", "run", "start:prod"]
