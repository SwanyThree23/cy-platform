#!/bin/bash
# ============================================================
# SeeWhy Live — Full VPS Setup Script
# Run as root: bash vps-setup.sh
# ============================================================
set -e

APP_DIR=/opt/seewhy-live/app
REPO="https://github.com/SwanyThree23/cy-platform.git"
BRANCH="claude/build-project-Qwnt4"

echo ""
echo "=========================================="
echo " SeeWhy Live — VPS Setup"
echo "=========================================="

# ── 1. System packages ──────────────────────────────────────
echo ""
echo "[1/7] Installing system packages..."
apt-get update -qq
apt-get install -y -qq git curl unzip nginx certbot python3-certbot-nginx

# ── 2. Node.js 20 ───────────────────────────────────────────
echo ""
echo "[2/7] Installing Node.js 20..."
if ! command -v node &>/dev/null || [[ $(node -v) != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  Node: $(node -v)  npm: $(npm -v)"

# ── 3. PM2 ──────────────────────────────────────────────────
echo ""
echo "[3/7] Installing PM2..."
npm install -g pm2 --silent
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ── 4. Pull code from GitHub ────────────────────────────────
echo ""
echo "[4/7] Pulling latest code from GitHub..."
mkdir -p /opt/seewhy-live

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  # Clone the mono-repo then symlink the app subfolder
  CLONE_DIR=/opt/seewhy-live/repo
  rm -rf "$CLONE_DIR"
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$CLONE_DIR"
  # Use the seewhy-live subdirectory as the app
  rm -rf "$APP_DIR"
  ln -sf "$CLONE_DIR/seewhy-live" "$APP_DIR"
fi

cd "$APP_DIR"
echo "  Code ready at $APP_DIR"

# ── 5. Create .env.local if missing ─────────────────────────
echo ""
echo "[5/7] Checking environment config..."
if [ ! -f "$APP_DIR/.env.local" ]; then
  cat > "$APP_DIR/.env.local" << 'ENVEOF'
NEXT_PUBLIC_APP_URL=https://seewhylive.online
NEXT_PUBLIC_WS_URL=wss://seewhylive.online
NODE_ENV=production
PORT=3000

NEXT_PUBLIC_SUPABASE_URL=https://rxlgywvfclyjdfyvfvyc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_CtHMhtj7hLmg8jejBnUrfA_BsWb0Lpb
SUPABASE_SERVICE_ROLE_KEY=REPLACE_WITH_YOUR_SERVICE_ROLE_KEY

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51Svbvv2N0KWn00Qu7HDAR92cb2M446cd6pEDs8CwmswhMowxtfOKRhljIlFOyRrJfddB6GUQrTSYg0WEe4SYmBA900a7dliDKW
STRIPE_SECRET_KEY=REPLACE_WITH_YOUR_STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET=REPLACE_WITH_YOUR_STRIPE_WEBHOOK_SECRET

NEXT_PUBLIC_LIVEKIT_URL=wss://seewhylive.online:7880
LIVEKIT_API_KEY=REPLACE_WITH_LIVEKIT_KEY
LIVEKIT_API_SECRET=REPLACE_WITH_LIVEKIT_SECRET

NEXTAUTH_SECRET=REPLACE_WITH_RANDOM_32_CHAR_STRING
ENVEOF
  echo "  Created .env.local — EDIT IT before starting the app!"
  echo "  nano $APP_DIR/.env.local"
else
  echo "  .env.local already exists — skipping"
fi

# ── 6. Build ────────────────────────────────────────────────
echo ""
echo "[6/7] Installing dependencies and building..."
cd "$APP_DIR"
npm ci --omit=dev --prefer-offline 2>/dev/null || npm install
npm run build

# ── 7. Start with PM2 ───────────────────────────────────────
echo ""
echo "[7/7] Starting app with PM2..."
pm2 delete seewhy-live 2>/dev/null || true
pm2 start npm --name "seewhy-live" -- start
pm2 save

echo ""
echo "=========================================="
echo " Setup complete!"
echo " App running on port 3000"
echo ""
echo " Next steps:"
echo "   1. Edit secrets: nano $APP_DIR/.env.local"
echo "   2. Run SSL:      certbot --nginx -d seewhylive.online"
echo "   3. Check logs:   pm2 logs seewhy-live"
echo "=========================================="
