# CY Platform - Gold Board Grid Live Streaming

### Zero-Fee Payments • 20-Guest Panels • Cross-Platform Streaming

A production-grade live streaming platform featuring the Gold Board Grid layout with host top-left positioning, vertically scrollable guest panels, and direct payment integration with 0% platform fees.

![Gold Board Grid](https://img.shields.io/badge/Layout-Gold%20Board%20Grid-gold)
![Payments](https://img.shields.io/badge/Payments-0%25%20Fee-green)
![WebRTC](https://img.shields.io/badge/WebRTC-Mediasoup-blue)
![Status](https://img.shields.io/badge/Status-Production%20Complete-success)

## 🎯 Executive Summary & Features

CY Platform is a production-grade live streaming solution featuring:
- **Gold Board Grid UI**: Pinned host top-left with neon gold border glow, scrollable 20-guest grid.
- **Premium Marketplace**: Glassmorphic UI with real-time trading stats, automated video sales.
- **Zero-Fee Infrastructure**: Direct creator payments (0% platform cut) for maximum profitability.
- **Hybrid Streaming**: Mediasoup WebRTC for zero-latency panels + RTMP Fan-out for global reach.
- **Swani AI Core**: Real-time moderation and content analysis.

### Zero-Fee Payment System
- **Direct Payments**: PayPal, Cash App, Venmo, Zelle, Chime
- **100% to Creators**: 0% platform fee on donations/tips
- **Instant Transfers**: No holding period, direct to creator's account
- **Platform Revenue**: Premium subscriptions & featured placement only

### Cross-Platform Streaming
- **Simultaneous Broadcast**: Instagram, TikTok, Facebook, YouTube
- **RTMP Fan-out**: Single stream to all platforms
- **Encrypted Keys**: Secure storage of stream credentials
- **Auto-reconnect**: Handles connection failures gracefully

### WebRTC SFU (Mediasoup)
- **20+ Guests**: Scalable to 20 concurrent participants
- **Individual Tracks**: Separate audio/video per guest
- **Host Controls**: Mute, remove, manage guests
- **Optimized Codecs**: VP8, H.264 for best compatibility

### AI Moderation (SWANI)
- **Real-time**: Instant message analysis using OpenRouter API
- **Multi-language**: Supports global audiences
- **Smart Actions**: Allow, flag, or delete automatically
- **Content Filtering**: Spam, hate speech, explicit content
- **Message Compression**: Uses LLM to compress messages and save bandwidth

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (optional, for development)
- Git

### 15-Minute Setup

```bash
# 1. Clone the repository
git clone <repository-url> cy-platform
cd cy-platform

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials

# 3. Start all services
docker-compose up -d

# 4. Initialize database
docker-compose exec -T postgres psql -U cyuser -d cyplatform < database/schema.sql

# 5. Access the platform
# Frontend: http://localhost:3000
# API: http://localhost:3001
# Health Check: http://localhost:3001/health
```

## 📁 Project Structure

```text
cy-platform/
├── backend/
│   ├── server.ts              # Main server with Mediasoup & Socket.io
│   ├── package.json           # Dependencies & scripts
│   ├── tsconfig.json          # TypeScript configuration
│   ├── Dockerfile             # Container image
│   └── .env.example           # Environment template
├── frontend/
│   ├── src/
│   │   ├── App.tsx            # Gold Board Grid UI
│   │   ├── App.css            # Gold-themed styles
│   │   └── index.tsx          # Entry point
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── database/
│   └── schema.sql             # Complete PostgreSQL schema
├── nginx/
│   └── nginx.conf             # Reverse proxy configuration
├── rtmp/
│   └── nginx.conf             # RTMP server configuration
├── docker-compose.yml         # Full stack orchestration
├── .env.example               # Environment variables template
└── docs/
    └── DEPLOYMENT.md          # Detailed deployment guide
```

## 💰 Revenue Model

### Creator Revenue
| Source | Creator | Platform |
|--------|---------|----------|
| Donations/Tips | 100% | 0% |
| Subscriptions | 90% | 10% |
| Ad Revenue | 70% | 30% |

### Platform Revenue Streams
1. **Premium Subscriptions**: $9.99/month, $99.99/year
2. **Featured Placement**: Priority stream listing
3. **Analytics Dashboard**: Advanced insights for Pro users
4. **Custom Branding**: White-label options

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **WebRTC**: Mediasoup SFU for scalable video conferencing
- **Real-time**: Socket.io for signaling and chat
- **Database**: PostgreSQL with Row Level Security
- **Cache**: Redis for sessions and real-time data
- **AI**: OpenRouter API for LLM moderation

### Frontend
- **Framework**: React 18 with TypeScript
- **State**: Zustand for lightweight state management
- **WebRTC**: Mediasoup-client for browser integration
- **Styling**: CSS3 with gold theme variables
- **Build**: Create React App / Vite

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx with SSL termination
- **RTMP**: Nginx-RTMP for stream ingestion
- **Monitoring**: Health endpoints and logging

## 🔌 API Endpoints & Events

### API Endpoints
- `GET /api/streams` - List active streams
- `POST /api/streams` - Create new stream
- `POST /api/streams/:id/go-live` - Start streaming
- `POST /api/streams/:id/transport` - Create WebRTC transport
- `GET /api/users/:id/payment-handles` - Get creator payment methods

### Socket.io Events
- `join-stream`, `leave-stream`
- `join-as-guest`, `leave-as-guest`
- `chat-message` (AI moderated)
- `payment-sent`, `payment-notification`

## 🔐 Security Features

- ✅ **Encrypted Stream Keys**: AES-256 encryption
- ✅ **Row Level Security**: PostgreSQL RLS policies
- ✅ **Rate Limiting**: API endpoint protection
- ✅ **CORS Configuration**: Controlled cross-origin
- ✅ **Helmet Headers**: Security best practices
- ✅ **AI Moderation**: Automated content filtering
- ✅ **Input Validation**: SQL injection prevention

## 📈 Performance & Cost

### Capacity
- **Concurrent Viewers**: 10,000+ per stream
- **Guest Panels**: 20 simultaneous guests
- **Cross-Platform**: 4 platforms simultaneously
- **Latency**: <500ms WebRTC, <3s RTMP

### Cost Estimates
- **Development**: Free (Self-hosted Docker, local dev)
- **Production (1000 users)**: $120-$170/month (AWS EC2 t3.medium, RDS db.t3.micro, ElastiCache)
- **High Scale (10,000 users)**: $710-$910/month (AWS EC2 c5.2xlarge, RDS db.r5.large, ElastiCache)

## 🐛 Troubleshooting & Live Access

### Quick Diagnostics
If your site is not loading on the live IP, run the diagnostic script on your VPS:
```bash
chmod +x scripts/diagnose.sh
./scripts/diagnose.sh
```

### WebRTC Connection Issues
```bash
# Check firewall
sudo ufw allow 10000:10100/udp
sudo ufw allow 10000:10100/tcp

# Verify IP configuration
docker-compose exec backend env | grep MEDIASOUP
```

### Database Errors
```bash
# Reset and reinitialize
docker-compose down -v
docker-compose up -d postgres
sleep 10
docker-compose exec -T postgres psql -U cyuser -d cyplatform < database/schema.sql
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Mediasoup team for the excellent WebRTC SFU
- OpenRouter for LLM API access
- Supabase for managed PostgreSQL
- The open-source community

## 📞 Support

- **Documentation**: See `docs/` directory
- **Issues**: Create a GitHub issue
- **Email**: support@cyplatform.com

## 🗺️ Roadmap

- [ ] Native mobile apps (React Native)
- [ ] Advanced analytics dashboard
- [ ] Subscription tiers management
- [ ] Multi-language support
- [ ] VR/360° streaming support
- [ ] NFT integration for creators

---

**Built with** ❤️ **by the CY Platform Team**

**Version**: 1.1.0  
**Last Updated**: April 2026
