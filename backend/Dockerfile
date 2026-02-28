FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

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
