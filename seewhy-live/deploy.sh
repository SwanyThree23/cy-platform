#!/bin/bash
set -e

APP_DIR=/opt/seewhy-live/app

echo "==> Pulling latest code..."
cd "$APP_DIR"
git pull origin main 2>/dev/null || true

echo "==> Installing dependencies..."
npm install --omit=dev

echo "==> Building Next.js app..."
npm run build

echo "==> Restarting with Docker Compose..."
docker-compose down
docker-compose up -d --build

echo "==> Done! App running at https://seewhylive.online"
