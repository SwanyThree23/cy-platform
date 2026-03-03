FROM node:18

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps && npm install -g typescript

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Expose WebRTC ports
EXPOSE 10000-10100/udp
EXPOSE 10000-10100/tcp

# Start the server
CMD ["npm", "start"]
