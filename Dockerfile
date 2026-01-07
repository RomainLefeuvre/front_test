# Multi-stage build for optimized production image

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with a static file server
FROM node:20-alpine

# Install a lightweight static file server
RUN npm install -g serve

# Copy built assets from builder stage
COPY --from=builder /app/dist /app

# Expose port 80
EXPOSE 80

# Start the static file server
CMD ["serve", "-s", "/app", "-l", "80"]
