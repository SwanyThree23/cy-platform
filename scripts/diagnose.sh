#!/bin/bash

# ============================================
# CY Platform - Diagnostic Script
# ============================================

echo "🔍 Starting CY Platform Diagnostics..."
echo "------------------------------------"

# 1. Check Docker Service
echo -n "Checking Docker service... "
if systemctl is-active --quiet docker; then
    echo "✅ Running"
else
    echo "❌ NOT RUNNING. Run: sudo systemctl start docker"
fi

# 2. Check Containers
echo "Checking CY containers..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep cy-

# 3. Check Internal Connectivity
echo "Checking internal service health..."
echo -n "Backend (3001): "
if curl -s --max-time 2 http://localhost:3001/health > /dev/null; then
    echo "✅ Up"
else
    echo "❌ DOWN"
fi

echo -n "Nginx (80): "
if curl -s --max-time 2 http://localhost:80/health > /dev/null; then
    echo "✅ Up"
else
    echo "❌ DOWN"
fi

# 4. Check Public IP & Port 80
PUBLIC_IP=$(curl -s -4 ifconfig.me)
echo "Public IP detected: $PUBLIC_IP"
echo "Checking Port 80 accessibility..."
if netstat -tuln | grep :80 > /dev/null; then
    echo "✅ Port 80 is listening locally"
else
    echo "❌ Port 80 is NOT listening"
fi

# 5. Check Environment Variables
echo "Verifying environment variables..."
if grep -q "MEDIASOUP_ANNOUNCED_IP=$PUBLIC_IP" .env; then
    echo "✅ MEDIASOUP_ANNOUNCED_IP matches Public IP"
else
    echo "⚠️ MEDIASOUP_ANNOUNCED_IP does not match Public IP ($PUBLIC_IP)"
fi

echo "------------------------------------"
echo "Done."
