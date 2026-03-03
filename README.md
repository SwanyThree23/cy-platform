# CY Platform - Gold Board Grid Live Streaming

### Zero-Fee Payments • 20-Guest Panels • Cross-Platform Streaming


A production-grade live streaming platform featuring the Gold Board Grid layout with host top-left positioning, vertically scrollable guest panels, and direct payment integration with 0% platform fees.

![Gold Board Grid](https://img.shields.io/badge/Layout-Gold%20Board%20Grid-gold)
![Payments](https://img.shields.io/badge/Payments-0%25%20Fee-green)
![WebRTC](https://img.shields.io/badge/WebRTC-Mediasoup-blue)

## 🎯 Key Features

### Gold Board Grid Layout

- **Host Panel**: Pinned at top-left with gold border
- **20 Guest Slots**: Vertically scrollable grid
- **Always Visible Host**: Host remains visible while scrolling guests
- **Responsive Design**: Adapts to desktop, tablet, and mobile

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
- **Real-time**: Instant message analysis
- **Multi-language**: Supports global audiences
- **Smart Actions**: Allow, flag, or delete automatically
- **Content Filtering**: Spam, hate speech, explicit content

### Marketplace & Video Posts
- **Video Storage**: Upload and share pre-recorded content
- **Direct Sales**: Sell videos directly to fans with 0% fee
- **Engagement**: View counts, likes, and creator attribution
- **Seamless Flow**: Integrated into the main Gold Board Grid experience


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

```
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
- **Build**: Create React App

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx with SSL termination
- **RTMP**: Nginx-RTMP for stream ingestion
- **Monitoring**: Health endpoints and logging

## 📊 Database Schema

### Core Tables
- **users**: Accounts, payment handles, encrypted stream keys
- **streams**: Live streams with cross-platform flags
- **stream_guests**: 20-guest panel management
- **payments**: Zero-fee transaction records
- **rtmp_relays**: Cross-platform streaming configuration
- **chat_messages**: AI-moderated chat history

See `database/schema.sql` for complete schema with indexes, RLS policies, and triggers.

## 🔌 API Endpoints

### Streams
```
GET    /api/streams              # List active streams
GET    /api/streams/:id          # Get stream details
POST   /api/streams              # Create new stream
POST   /api/streams/:id/go-live  # Start streaming
POST   /api/streams/:id/end      # End stream
```

### WebRTC Signaling
```
GET    /api/streams/:id/rtp-capabilities
POST   /api/streams/:id/transport
POST   /api/streams/:id/transport/:id/connect
POST   /api/streams/:id/transport/:id/produce
POST   /api/streams/:id/transport/:id/consume
```

### Payments
```
GET    /api/users/:id/payment-handles
PUT    /api/users/:id/payment-handles
PUT    /api/users/:id/stream-keys
```

### Marketplace
```
GET    /api/marketplace               # List all video posts
POST   /api/marketplace               # Create a new video post
POST   /api/marketplace/purchase      # Record a video purchase
```


## 🔐 Security Features

- ✅ **Encrypted Stream Keys**: AES-256 encryption
- ✅ **Row Level Security**: PostgreSQL RLS policies
- ✅ **Rate Limiting**: API endpoint protection
- ✅ **CORS Configuration**: Controlled cross-origin
- ✅ **Helmet Headers**: Security best practices
- ✅ **AI Moderation**: Automated content filtering
- ✅ **Input Validation**: SQL injection prevention

## 📈 Performance

### Capacity
- **Concurrent Viewers**: 10,000+ per stream
- **Guest Panels**: 20 simultaneous guests
- **Cross-Platform**: 4 platforms simultaneously
- **Latency**: <500ms WebRTC, <3s RTMP

### Optimizations
- Worker pool for Mediasoup (load distribution)
- Redis caching for session data
- PostgreSQL indexing for fast queries
- CDN-ready static assets
- Gzip/Brotli compression

## 💵 Cost Estimates

### Development (Free)
- Supabase free tier
- Self-hosted Docker
- Local development

### Production ($200-500/month for 1000 users)
- AWS EC2 t3.medium: $30
- RDS PostgreSQL: $25
- ElastiCache Redis: $15
- Data Transfer: $100-300
- S3 Storage: $10

### High Scale ($1000+/month for 10,000 users)
- AWS EC2 c5.2xlarge: $140
- RDS db.r5.xlarge: $350
- CDN & Data Transfer: $400-700

## 🎨 Customization

### Gold Theme Variables
```css
:root {
  --gold-primary: #FFD700;
  --gold-dark: #DAA520;
  --gold-light: #FFE55C;
  --black: #0a0a0a;
  --dark-gray: #1a1a1a;
}
```

### Adding Payment Methods
Edit `frontend/src/App.tsx` PaymentButtons component:
```typescript
const paymentMethods = [
  { key: 'paypal', label: 'PayPal', color: '#003087' },
  // Add your custom payment method here
];
```

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

### Stream Key Issues
Ensure stream keys are properly encrypted in the database:
```sql
-- Verify encrypted keys exist
SELECT id, instagram_stream_key IS NOT NULL as has_instagram
FROM users WHERE id = 'your-user-id';
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

**Version**: 1.0.0  
**Last Updated**: February 2026
