# Use a small base image with Node.js
FROM node:20-slim

# Install upower (needed for battery status)
RUN apt-get update && \
    apt-get install -y upower && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN npm i -g pnpm

# Set working directory
WORKDIR /app

# Copy only what's needed first for better layer caching
COPY package*.json ./

# Install only production dependencies
RUN pnpm install

# Copy the rest of the code
COPY . .

# Expose the port the app runs on
EXPOSE 1211

# Run the monitor
CMD ["node", "index.js"]
