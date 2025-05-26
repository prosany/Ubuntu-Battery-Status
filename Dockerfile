# Use a small base image with Node.js
FROM node:20-slim

# Install upower (needed for battery status)
RUN apt-get update && \
    apt-get install -y upower && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy only what's needed first for better layer caching
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the rest of the code
COPY . .

# Run the monitor
CMD ["node", "index.js"]
