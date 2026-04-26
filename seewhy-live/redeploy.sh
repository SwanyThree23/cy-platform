#!/bin/bash
# Quick redeploy — run this after any code update
set -e
APP_DIR=/opt/seewhy-live/app

echo "Pulling latest code..."
cd /opt/seewhy-live/repo 2>/dev/null && git pull origin claude/build-project-Qwnt4 || true

echo "Building..."
cd "$APP_DIR"
npm ci --omit=dev 2>/dev/null || npm install
npm run build

echo "Restarting..."
pm2 restart seewhy-live

echo "Done. Check: pm2 logs seewhy-live"
