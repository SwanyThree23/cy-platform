#!/bin/bash

# ============================================
# CY Platform - Hostinger VPS Deployment Script
# ============================================

# 1. STOP OLD APP
echo "Stopping current services..."
docker-compose down

# 2. PULL LATEST CHANGES
echo "Pulling latest code from GitHub..."
git pull origin main

# 3. CONFIGURE ENVIRONMENT
# Ensure .env exists, if not copy from example
if [ ! -f .env ]; then
    echo "Creating .env from example..."
    cp .env.example .env
fi

# 4. BUILD AND START (Advanced Mode)
# This will build the mediasoup-enabled backend and react frontend
echo "Rebuilding and starting services (this takes a few minutes)..."
docker-compose up -d --build

# 5. INITIALIZE DATABASE (Prisma)
echo "Ensuring database schema is up-to-date..."
docker-compose exec -T backend npx prisma db push --accept-data-loss

echo "Deployment complete!"
echo "Check logs with: docker-compose logs -f backend"
