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

# 5. INITIALIZE DATABASE (Run once or safely)
echo "Ensuring database schema is up-to-date..."
# Wait for postgres to be ready
until docker-compose exec -T postgres pg_isready -U cyuser -d cyplatform; do
  echo "Waiting for PostgreSQL to be ready..."
  sleep 2
done

# Run the schema script
docker-compose exec -T postgres psql -U cyuser -d cyplatform < database/schema.sql

# 6. SETUP SSL (Let's Encrypt - Optional but Recommended)
# To use this, you must have your domain pointing to this IP
# sudo apt install certbot -y
# sudo certbot certonly --standalone -d your-domain.com

echo "Deployment complete!"
echo "Check logs with: docker-compose logs -f backend"
