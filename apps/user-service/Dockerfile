# user-service/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy root package files first (for monorepo)
COPY package*.json ./
COPY package-lock.json ./

# Copy service package.json
COPY apps/user-service/package*.json ./apps/user-service/

# Install all dependencies (root + workspaces)
RUN npm install --legacy-peer-deps

# Copy the service source code
COPY apps/user-service ./apps/user-service

# Set working directory to the service
WORKDIR /app/apps/user-service

# Build the service
RUN npm run build

# Expose the service port
EXPOSE 4000

# Start the service
CMD ["npm", "run", "start:dev"]
