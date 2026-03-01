FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Serve the app (Start DEV server since react-scripts build is failing memory limits on VPS)
CMD ["npm", "start"]
