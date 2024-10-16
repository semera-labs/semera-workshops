# Stage 1: Build the application
FROM node:18-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve the application using a lightweight image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy the built application from the builder stage
COPY --from=builder /app ./

# Expose port 3000 (or the port your application uses)
EXPOSE 3000

# Ensure the entrypoint script is executable
RUN chmod +x ./entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["./entrypoint.sh"]
