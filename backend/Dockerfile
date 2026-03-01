FROM node:18-bullseye-slim

WORKDIR /app

# Install build tools required by mediasoup
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Expose WebRTC ports
EXPOSE 10000-10100/udp
EXPOSE 10000-10100/tcp

# Start the server
CMD ["npm", "start"]
