import React, { useEffect, useRef, useState } from 'react';
import { Device } from 'mediasoup-client';
import { io, Socket } from 'socket.io-client';
import { 
  useUser, 
  useAuth, 
  UserButton, 
  SignInButton, 
  SignedIn, 
  SignedOut 
} from '@clerk/clerk-react';
import { 
  ShoppingBag,
  Users,
  Activity,
  ArrowRight,
  Star,
  Radio,
  Layout,
  Plus,
  Play,
  DollarSign,
  Mic,
  Shield,
  Zap
} from 'lucide-react';
import './App.css';
import { CreatorDashboard } from './CreatorDashboard';
import ReactPlayer from 'react-player';

const SafeReactPlayer = ReactPlayer as any;
const SafeSignedIn = SignedIn as any;
const SafeSignedOut = SignedOut as any;

// ============================================
// TYPES
// ============================================

interface Stream {
  id: string;
  host_id: string;
  title: string;
  description?: string;
  host_username: string;
  host_display_name: string;
  host_avatar?: string;
  category_name?: string;
  current_viewers: number;
  status: 'scheduled' | 'live' | 'ended';
}

interface Guest {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  gridPosition: number;
  transportId?: string;
  producerId?: string;
  isMuted?: boolean;
  isRaisingHand?: boolean;
  role?: 'host' | 'mod' | 'guest';
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
  aiAction?: 'allow' | 'flag' | 'delete';
  aiConfidence?: number;
}

interface PaymentHandle {
  paypal?: string;
  cashapp?: string;
  venmo?: string;
  zelle?: string;
  chime?: string;
}

interface VideoPost {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  price: number;
  currency: string;
  is_for_sale: boolean;
  views_count: number;
  likes_count: number;
  author?: {
    username: string;
    display_name: string;
    avatar_url?: string;
  };
  created_at: string;
}

interface WatchPartyGuest {
  id: string;
  gridPosition: number;
  userId: string;
}

// ============================================
// STAGE / PARTICIPANT PANEL
// ============================================

const ParticipantStage: React.FC<{
  participants: { 
    id: string; 
    name: string; 
    avatar?: string; 
    isSpeaking?: boolean; 
    isSharing?: boolean; 
    isReady?: boolean;
    isMuted?: boolean;
    role?: 'host' | 'mod' | 'guest';
    likes?: number;
  }[];
}> = ({ participants }) => {
  return (
    <div className="participant-stage glass-effect">
      <div className="stage-header">
        <Users size={14} className="icon-gold" />
        <span>STAGE ({participants.length})</span>
      </div>
      <div className="participant-grid">
        {participants.map((p) => (
          <div key={p.id} className={`participant-bubble ${p.isSpeaking ? 'speaking-glow' : ''}`}>
            <div className="avatar-wrapper">
              {p.avatar ? (
                <img src={p.avatar} alt={p.name} className="participant-avatar" />
              ) : (
                <div className="participant-avatar-placeholder">{p.name[0]}</div>
              )}
              {p.isSharing && <div className="sharing-indicator"><Layout size={8} /></div>}
              {p.isMuted && <div className="muted-indicator"><Mic size={8} className="icon-red-slash" /></div>}
              {p.role === 'host' && <div className="role-badge crown-gold">👑</div>}
              <div className={`status-dot ${p.isReady ? 'online' : 'offline'}`}></div>
              <button className="bubble-like-btn" title="Glow participant" aria-label="Glow participant"><Star size={8} /></button>
            </div>
            <div className="participant-info">
              <span className="participant-name">{p.name}</span>
              {p.isSpeaking && <span className="speaking-label">Speaking...</span>}
            </div>
          </div>
        ))}
        <button className="add-participant-btn" aria-label="Invite to Stage" title="Invite to Stage">
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};

// ============================================
// STREAM TELEMETRY & INSIGHTS
// ============================================

const StreamTelemetry: React.FC<{
  metrics: { viewers: number; peak: number; revenue: number; signal: number };
}> = ({ metrics }) => {
  return (
    <div className="stream-telemetry-bar glass-effect">
      <div className="telemetry-item">
        <span className="telemetry-label">UPLINK STATUS</span>
        <span className="telemetry-value status-live">SECURE</span>
      </div>
      <div className="telemetry-item">
        <span className="telemetry-label">VIEWER MATRIX</span>
        <span className="telemetry-value">{metrics.viewers.toLocaleString()}</span>
      </div>
      <div className="telemetry-item">
        <span className="telemetry-label">SIGNAL INTEGRITY</span>
        <div className="signal-meter">
          <div className="signal-bar" style={{ '--signal-width': `${metrics.signal}%` } as React.CSSProperties}></div>
        </div>
        <span className="telemetry-value">{metrics.signal}%</span>
      </div>
      <div className="telemetry-item">
        <span className="telemetry-label">REVENUE FLOW</span>
        <span className="telemetry-value text-gold">${metrics.revenue.toFixed(2)}</span>
      </div>
    </div>
  );
};

const AIInsights: React.FC<{
  summaries: string[];
}> = ({ summaries }) => {
  if (summaries.length === 0) return null;
  
  return (
    <div className="ai-insights-panel glass-effect fade-in">
      <div className="insights-header">
        <Zap size={14} className="icon-gold" />
        <span>AURA SIGNAL HIGHLIGHTS</span>
      </div>
      <div className="insights-list">
        {summaries.map((s, i) => (
          <div key={i} className="insight-item">
            <p>{s}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// MARKETPLACE VIEW COMPONENT
// ============================================

const MarketplaceView: React.FC<{
  userId: string;
  onBack: () => void;
  getToken: () => Promise<string | null>;
}> = ({ userId, onBack, getToken }) => {
  const [posts, setPosts] = useState<VideoPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    price: 0,
    isForSale: true
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/marketplace');
      const data = await response.json();
      setPosts(data);
    } catch (error) {
      console.error('Failed to fetch marketplace:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (post: VideoPost) => {
    try {
      const token = await getToken();
      const response = await fetch('/api/marketplace/create-checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videoPostId: post.id }),
      });
      
      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    
    try {
      const token = await getToken();
      // First, get an upload URL from Mux (via our backend)
      const uploadRes = await fetch('/api/creators/upload-url', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      
      const { uploadUrl, id: uploadId } = await uploadRes.json();
      
      // In a real app, you'd perform a PUT request to uploadUrl here
      // For this workflow, we'll simulate the successful Mux upload
      
      const response = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId,
          ...uploadData,
          videoUrl: `https://stream.mux.com/${uploadId}/high.mp4`,
          thumbnailUrl: `https://image.mux.com/${uploadId}/thumbnail.jpg`,
          muxAssetId: uploadId
        }),
      });

      if (response.ok) {
        setUploadData({ title: '', description: '', price: 0, isForSale: true });
        fetchPosts();
        alert('Video listed successfully! (Staking processing via Mux)');
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="marketplace-view">
      <header className="marketplace-header glass-effect">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="header-title-group">
          <ShoppingBag className="icon-gold" />
          <h2 className="glow-text">CY Marketplace</h2>
        </div>
        <div className="marketplace-stats-bar">
          <div className="stat-item">
            <span className="stat-value">{posts.length}</span>
            <span className="stat-label">Videos</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">$0.00</span>
            <span className="stat-label">Platform Fees</span>
          </div>
          <div className="stat-item">
            <span className="stat-value pulse">LIVE</span>
            <span className="stat-label">Trading</span>
          </div>
        </div>
      </header>


      <div className="marketplace-content">
        <aside className="upload-sidebar gold-border">
          <div className="sidebar-header">
            <Zap size={18} className="icon-red" />
            <h3>List Your Signal</h3>
          </div>
          <p>Sell content at your price. Zero cuts.</p>
          <form className="upload-form" onSubmit={handleUpload}>
            <div className="input-field">
              <label htmlFor="post-title">Video Title</label>
              <input 
                id="post-title"
                type="text" 
                placeholder="Enter a catchy title" 
                className="chat-input" 
                value={uploadData.title}
                onChange={e => setUploadData({...uploadData, title: e.target.value})}
                required 
              />
            </div>
            <div className="input-field">
              <label htmlFor="post-desc">Description</label>
              <textarea 
                id="post-desc"
                placeholder="Tell viewers about your video" 
                className="chat-input" 
                value={uploadData.description}
                onChange={e => setUploadData({...uploadData, description: e.target.value})}
              />
            </div>

            <div className="price-input-group">
              <label htmlFor="post-price">Price (USD)</label>
              <div className="price-input-wrapper">
                <DollarSign size={16} />
                <input 
                  id="post-price"
                  type="number" 
                  className="chat-input" 
                  value={uploadData.price}
                  onChange={e => setUploadData({...uploadData, price: parseFloat(e.target.value)})}
                  step="0.01" 
                />
              </div>
            </div>
            <button type="submit" className="host-btn" disabled={isUploading}>
              {isUploading ? (
                <span className="loading-spinner">PROCESSING...</span>
              ) : (
                <><Plus size={18} /> LIST VIDEO</>
              )}
            </button>
          </form>
        </aside>

        <main className="posts-grid">
          {loading ? (
            <div className="loading-state">
              <div className="signal-pulse"></div>
              <p>FETCHING MARKET DATA...</p>
            </div>
          ) : (
            posts.map(post => (
              <div key={post.id} className="post-card gold-border">
                <div className="post-thumbnail">
                  <img src={post.thumbnail_url} alt={post.title} />
                  {post.price > 0 && <span className="price-tag">${post.price}</span>}
                  <button className="play-overlay" aria-label="Play video"><Play fill="white" size={32} /></button>
                </div>
                <div className="post-info">
                  <h4>{post.title}</h4>
                  <p className="post-author">SIGNAL BY: {post.author?.display_name || post.user_id}</p>
                  <div className="post-actions">
                    <button className="like-btn">❤️ {post.likes_count}</button>
                    <button 
                      className="buy-btn"
                      onClick={() => handlePurchase(post)}
                    >
                      BUY NOW
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
          {posts.length === 0 && !loading && (
            <div className="no-posts">
              <p>THE MARKET IS QUIET. BE THE SIGNAL.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};


// ============================================
// GOLD BOARD GRID COMPONENT
// ============================================

const GoldBoardGrid: React.FC<{
  streamId: string;
  isHost: boolean;
  userId: string;
  localStream: MediaStream | null;
  guests: Guest[];
  onJoinAsGuest: () => void;
  onLeaveAsGuest: () => void;
  currentGuestId?: string;
  hostRemoteStream?: MediaStream | null;
}> = ({ 
  streamId, 
  isHost, 
  userId, 
  localStream, 
  guests, 
  onJoinAsGuest,
  onLeaveAsGuest,
  currentGuestId,
  hostRemoteStream
}) => {
  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const guestVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [speakingGuestId, setSpeakingGuestId] = useState<string | null>(null);

  // Simulation: Random speaking indicators
  useEffect(() => {
    const interval = setInterval(() => {
      if (guests.length > 0) {
        const randomGuest = guests[Math.floor(Math.random() * guests.length)];
        setSpeakingGuestId(randomGuest.id);
        setTimeout(() => setSpeakingGuestId(null), 2000);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [guests]);

  useEffect(() => {
    if (hostVideoRef.current) {
      if (isHost && localStream) {
        hostVideoRef.current.srcObject = localStream;
      } else if (!isHost && hostRemoteStream) {
        hostVideoRef.current.srcObject = hostRemoteStream;
      }
    }
  }, [localStream, hostRemoteStream, isHost]);

  const setGuestVideoRef = (guestId: string, el: HTMLVideoElement | null) => {
    if (el) {
      guestVideoRefs.current.set(guestId, el);
    }
  };

  return (
    <div className="gold-board-grid fade-in">
      {/* Host Panel - Top Left with Gold Border */}
      <div className={`host-panel ${isHost || localStream || hostRemoteStream ? 'gold-border' : ''}`}>
        <div className="panel-label">
           <Activity size={10} className="icon-gold" /> HOST
        </div>
        <video
          ref={hostVideoRef}
          autoPlay
          muted={isHost}
          playsInline
          className="video-element"
        />
        {!localStream && (
          <div className="video-placeholder">
            <span className="live-indicator">● LIVE</span>
          </div>
        )}
      </div>

      {/* Guest Panels Grid - Scrollable */}
      <div className="guests-container">
        <div className="guests-grid">
          {guests.map((guest) => (
            <div key={guest.id} className={`guest-panel ${speakingGuestId === guest.id ? 'speaking' : ''}`}>
              <div className="panel-label">GUEST {guest.gridPosition + 1}</div>
              <video
                ref={(el) => setGuestVideoRef(guest.id, el)}
                autoPlay
                playsInline
                className="video-element"
              />
              <div className="speaking-indicator"></div>
              <div className="guest-info">
                <span className="guest-name">{guest.username}</span>
              </div>
            </div>
          ))}

          {/* Empty Slots & Requests */}
          {Array.from({ length: 9 }).map((_, index) => {
            const guest = guests.find(g => g.gridPosition === index);
            if (guest) return null; // Handled by map above in real logic
            
            return (
              <div key={`empty-${index}`} className="guest-panel empty request-slot">
                <div className="panel-label">SLOT {index + 1}</div>
                <div className="video-placeholder">
                  <Plus size={32} className="icon-faint" />
                  <span className="request-text">Request</span>
                </div>
                {!isHost && !currentGuestId && (
                  <button 
                    className="join-slot-btn"
                    onClick={onJoinAsGuest}
                    title="Request to Join"
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {currentGuestId && (
        <button className="leave-panel-btn" onClick={onLeaveAsGuest}>
          Leave Panel
        </button>
      )}
    </div>
  );
};

// ============================================
// PAYMENT BUTTONS COMPONENT
// ============================================

const PaymentButtons: React.FC<{
  handles: PaymentHandle;
  displayName: string;
  onPaymentClick?: (method: string, url: string) => void;
}> = ({ handles, displayName, onPaymentClick }) => {
  const paymentMethods = [
    { key: 'paypal', label: 'PayPal', icon: '💳', color: '#003087' },
    { key: 'cashapp', label: 'Cash App', icon: '💵', color: '#00D632' },
    { key: 'venmo', label: 'Venmo', icon: '💸', color: '#008CFF' },
    { key: 'zelle', label: 'Zelle', icon: '🏦', color: '#6B1F7C' },
    { key: 'chime', label: 'Chime', icon: '🏧', color: '#25C281' },
  ];

  const getPaymentUrl = (method: string, handle: string): string => {
    switch (method) {
      case 'paypal':
        return `https://paypal.me/${handle}`;
      case 'cashapp':
        return `https://cash.app/$${handle}`;
      case 'venmo':
        return `https://venmo.com/${handle}`;
      case 'chime':
        return `https://chime.com/${handle}`;
      default:
        return '';
    }
  };

  return (
    <div className="payment-section">
      <h3 className="payment-title">Support {displayName}</h3>
      <p className="payment-subtitle">90% to Creator • 10% Platform Fee</p>
      
      <div className="payment-buttons">
        {paymentMethods.map((method) => {
          const handle = handles[method.key as keyof PaymentHandle];
          if (!handle) return null;

          const url = getPaymentUrl(method.key, handle);
          
          if (method.key === 'zelle') {
            return (
              <button
                key={method.key}
                className={`payment-btn ${method.key}`}
                onClick={() => {
                  alert(`Zelle payments go to: ${handle}`);
                  onPaymentClick?.(method.key, '');
                }}
              >
                <span className="payment-icon">{method.icon}</span>
                <span className="payment-label">{method.label}</span>
                <span className="payment-handle">{handle}</span>
              </button>
            );
          }

          return (
            <a
              key={method.key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`payment-btn ${method.key}`}
              onClick={() => onPaymentClick?.(method.key, url)}
            >
              <span className="payment-icon">{method.icon}</span>
              <span className="payment-label">{method.label}</span>
              <span className="payment-handle">{handle}</span>
            </a>
          );
        })}
      </div>
      
      <div className="payment-notice">
        🔒 Secure direct payment • No account required • Instant transfer
      </div>
    </div>
  );
};

// ============================================
// CHAT COMPONENT
// ============================================

const ChatPanel: React.FC<{
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentUser: string;
  hostId?: string;
}> = ({ messages, onSendMessage, currentUser, hostId }) => {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      onSendMessage(inputMessage);
      setInputMessage('');
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>Live Chat</h3>
        <div className="ai-controls">
          <button 
            className="ai-action-btn"
            onClick={() => onSendMessage("!summarize")} 
            title="Summarize Chat"
          >
            <Activity size={14} />
          </button>
          <div className="ai-assistant-badge aura-pulse">AURA ACTIVE</div>
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message ${msg.userId === currentUser ? 'own' : ''} ${msg.aiAction === 'flag' ? 'flagged' : ''}`}
          >
            <div className="chat-msg-header">
              <span className={`chat-username ${msg.userId === hostId ? 'creator-name' : ''}`}>
                {msg.username}
                {msg.userId === hostId && <Shield size={10} className="icon-gold" style={{marginLeft: '4px'}} />}
              </span>
              {msg.aiAction === 'flag' && <Shield size={10} className="icon-red" />}
              {msg.aiConfidence && msg.aiConfidence > 0.8 && <Zap size={8} className="icon-gold" title={`Aura Confidence: ${Math.round(msg.aiConfidence * 100)}%`} />}
            </div>
            <span className="chat-text">
              {msg.aiAction === 'flag' ? `[FLAGGED] ${msg.message}` : msg.message}
            </span>
            <span className="chat-time">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type a message..."
          className="chat-input"
          maxLength={200}
        />
        <button type="submit" className="chat-send-btn">
          Send
        </button>
      </form>
    </div>
  );
};

// ============================================
// MAIN STREAM VIEW COMPONENT
// ============================================

const StreamView: React.FC<{
  streamId: string;
  userId: string;
  isHost: boolean;
  socket: Socket;
}> = ({ streamId, userId, isHost, socket }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hostRemoteStream, setHostRemoteStream] = useState<MediaStream | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [paymentHandles, setPaymentHandles] = useState<PaymentHandle>({});
  const [streamInfo, setStreamInfo] = useState<Stream | null>(null);
  const [currentGuestId, setCurrentGuestId] = useState<string>();
  const [activeDonation, setActiveDonation] = useState<{ amount: string, senderName: string, message: string } | null>(null);
  const [streamMetrics, setStreamMetrics] = useState({ viewers: 2420, peak: 2850, revenue: 124.50, signal: 98 });
   const [aiSummaries, setAiSummaries] = useState<string[]>([]);
  const [pinnedItem, setPinnedItem] = useState<VideoPost | null>(null);
  const [sharedMediaUrl, setSharedMediaUrl] = useState<string | null>('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); // Simulated watch party
  const [roomLikes, setRoomLikes] = useState(54);
  
  // Simulation for dynamic telemetry
  useEffect(() => {
    const interval = setInterval(() => {
      setStreamMetrics(prev => ({
        ...prev,
        viewers: prev.viewers + Math.floor(Math.random() * 10 - 5),
        signal: Math.max(92, Math.min(100, prev.signal + (Math.random() > 0.5 ? 1 : -1)))
      }));
    }, 3000);

    // Simulation: A pinned marketplace item
    setTimeout(() => {
      setPinnedItem({
        id: 'pinned-1',
        title: 'Limited Edition Backstage Pass',
        price: 49.99,
        video_url: '',
        user_id: streamId,
        is_for_sale: true,
        views_count: 0,
        likes_count: 0,
        created_at: new Date().toISOString(),
        currency: 'USD'
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [streamId]);
  // Mediasoup state
  // @ts-ignore
  const [device, setDevice] = useState<Device | null>(null);
  // @ts-ignore
  const [sendTransport, setSendTransport] = useState<any>(null);
  // @ts-ignore
  const [recvTransports, setRecvTransports] = useState<Map<string, any>>(new Map());
  // @ts-ignore
  const [producers, setProducers] = useState<Map<string, any>>(new Map());
  // @ts-ignore
  const [consumers, setConsumers] = useState<Map<string, any>>(new Map());

  // Initialize Mediasoup device
  useEffect(() => {
    const initDevice = async () => {
      try {
        const newDevice = new Device();
        
        // Get RTP capabilities from server
        const response = await fetch(`/api/streams/${streamId}/rtp-capabilities`);
        const { rtpCapabilities } = await response.json();
        
        await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
        setDevice(newDevice);
        
        console.log('[Mediasoup] Device initialized');
      } catch (error) {
        console.error('[Mediasoup] Failed to initialize device:', error);
      }
    };

    initDevice();
  }, [streamId]);

  // Get local media stream
  useEffect(() => {
    const getLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true,
        });
        setLocalStream(stream);
      } catch (error) {
        console.error('Failed to get local stream:', error);
      }
    };

    if (isHost || currentGuestId) {
      getLocalStream();
    }
  }, [isHost, currentGuestId]);

  // Join stream room
  useEffect(() => {
    socket.emit('join-stream', { streamId, userId, isHost });

    socket.on('joined-stream', async (data) => {
      console.log('[Socket] Joined stream:', data.streamId);
      
      // Create send transport if host or guest
      if ((isHost || currentGuestId) && device) {
        await createSendTransport();
      }
    });

    socket.on('chat-message', (message: ChatMessage) => {
      setChatMessages((prev) => [...prev, message]);
    });

    socket.on('guest-joined-panel', (guest: Guest) => {
      setGuests((prev) => [...prev, guest]);
    });

    socket.on('guest-left-panel', ({ guestId }: { guestId: string }) => {
      setGuests((prev) => prev.filter((g) => g.id !== guestId));
    });

    socket.on('new-producer', async ({ producerId, kind, socketId }: any) => {
      console.log('[Socket] New producer:', producerId, kind, 'from:', socketId);
      // Create consumer for the new producer
      await createConsumer(producerId, socketId);
    });

    socket.on('payment-notification', (donation: { amount: string, senderName: string, message: string }) => {
      setActiveDonation(donation);
      setStreamMetrics(prev => ({ ...prev, revenue: prev.revenue + parseFloat(donation.amount) }));
      setTimeout(() => setActiveDonation(null), 8000); 
    });

    socket.on('stream-summary', (summary: string) => {
      setAiSummaries(prev => [summary, ...prev].slice(0, 3));
    });

    return () => {
      socket.off('joined-stream');
      socket.off('chat-message');
      socket.off('guest-joined-panel');
      socket.off('guest-left-panel');
      socket.off('new-producer');
      socket.off('payment-notification');
      socket.off('stream-summary');
    };
  }, [socket, streamId, userId, isHost, device, currentGuestId]);

  // Create send transport for publishing
  const createSendTransport = async () => {
    if (!device) return;

    try {
      const response = await fetch(`/api/streams/${streamId}/transport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: userId, direction: 'send' }),
      });

      const { transportId, iceParameters, iceCandidates, dtlsParameters } = await response.json();

      const transport = device.createSendTransport({
        id: transportId,
        iceParameters,
        iceCandidates,
        dtlsParameters,
      });

      transport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.emit(
          'connect-transport',
          { streamId, transportId, dtlsParameters },
          (response: any) => {
            if (response.error) {
              errback(new Error(response.error));
            } else {
              callback();
            }
          }
        );
      });

      transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        socket.emit(
          'produce',
          { streamId, transportId, kind, rtpParameters },
          (response: any) => {
            if (response.error) {
              errback(new Error(response.error));
            } else {
              callback({ id: response.producerId });
            }
          }
        );
      });

      setSendTransport(transport);

      // Produce video and audio tracks
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        const audioTrack = localStream.getAudioTracks()[0];

        if (videoTrack) {
          await transport.produce({ track: videoTrack });
        }
        if (audioTrack) {
          await transport.produce({ track: audioTrack });
        }
      }
    } catch (error) {
      console.error('Failed to create send transport:', error);
    }
  };

  // Create consumer for receiving
  const createConsumer = async (producerId: string, producerSocketId?: string) => {
    if (!device) return;

    try {
      const response = await fetch(`/api/streams/${streamId}/transport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: `${userId}-recv-${producerId}`, direction: 'recv' }),
      });

      const { transportId, iceParameters, iceCandidates, dtlsParameters } = await response.json();

      const transport = device.createRecvTransport({
        id: transportId,
        iceParameters,
        iceCandidates,
        dtlsParameters,
      });

      transport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.emit(
          'connect-transport',
          { streamId, transportId, dtlsParameters },
          (response: any) => {
            if (response.error) {
              errback(new Error(response.error));
            } else {
              callback();
            }
          }
        );
      });

      const { rtpCapabilities } = device;
      
      socket.emit(
        'consume',
        { streamId, transportId, producerId, rtpCapabilities },
        async (response: any) => {
          if (response.error) {
            console.error('Failed to consume:', response.error);
            return;
          }

          const consumer = await transport.consume({
            id: response.consumerId,
            producerId: response.producerId,
            kind: response.kind,
            rtpParameters: response.rtpParameters,
          });

          await consumer.resume();

          // Add track to appropriate video element
          const stream = new MediaStream([consumer.track]);
          
          if (producerSocketId === 'server-ingest' || (!isHost && producerSocketId === 'host')) {
            console.log('[Mediasoup] Setting host stream');
            setHostRemoteStream((prev) => {
               if (!prev) return stream;
               // Add track to existing stream if it's already created (e.g. video added to audio)
               const newStream = new MediaStream(prev.getTracks());
               newStream.addTrack(consumer.track);
               return newStream;
            });
          } else {
             // For guests, we would update the guests state with the track
             // (Logic for guest track assignment omitted for brevity but standard in SFUs)
             console.log('[Mediasoup] Consuming stream from guest producer:', producerId);
          }
        }
      );

      setRecvTransports((prev) => new Map(prev).set(producerId, transport));
    } catch (error) {
      console.error('Failed to create consumer:', error);
    }
  };

  // Fetch stream info and payment handles
  useEffect(() => {
    const fetchStreamInfo = async () => {
      try {
        const response = await fetch(`/api/streams/${streamId}`);
        const data = await response.json();
        setStreamInfo(data);

        // Get payment handles
        const paymentResponse = await fetch(`/api/users/${data.host_id}/payment-handles`);
        const paymentData = await paymentResponse.json();
        setPaymentHandles(paymentData.handles);
      } catch (error) {
        console.error('Failed to fetch stream info:', error);
      }
    };

    fetchStreamInfo();
  }, [streamId]);

  const handleSendMessage = (message: string) => {
    socket.emit('chat-message', {
      streamId,
      message,
      userId,
      username: 'User', // Get from auth context
    });
  };

  const handleJoinAsGuest = () => {
    // Find first available position
    const occupiedPositions = new Set(guests.map((g) => g.gridPosition));
    let position = 0;
    while (occupiedPositions.has(position) && position < 20) {
      position++;
    }

    if (position < 20) {
      socket.emit('join-as-guest', { streamId, userId, gridPosition: position });
    }
  };

  const handleLeaveAsGuest = () => {
    if (currentGuestId) {
      socket.emit('leave-as-guest', { streamId, guestId: currentGuestId });
      setCurrentGuestId(undefined);
    }
  };

  const handlePaymentClick = (method: string, url: string) => {
    // Notify server about payment (for live display)
    socket.emit('payment-sent', {
      streamId,
      amount: 'Tip', // This would come from actual payment
      senderName: 'Anonymous',
      message: `Sent via ${method}`,
    });
  };

  return (
    <div className="stream-view">
      <div className="stream-main">
        {sharedMediaUrl && (
          <div className="shared-media-container glass-panel gold-border fade-in">
             <div className="media-header">
                <span className="media-badge">WATCH PARTY</span>
                <h3>Shared Activity: A.I. Music Biz Talk</h3>
             </div>
             <div className="video-wrapper">
               <SafeReactPlayer 
                  url={sharedMediaUrl} 
                  width="100%" 
                  height="100%" 
                  playing 
                  muted={true}
                  controls
                />
             </div>
          </div>
        )}

        <GoldBoardGrid
          streamId={streamId}
          isHost={isHost}
          userId={userId}
          localStream={localStream}
          hostRemoteStream={hostRemoteStream}
          guests={guests}
          onJoinAsGuest={handleJoinAsGuest}
          onLeaveAsGuest={handleLeaveAsGuest}
          currentGuestId={currentGuestId}
        />

        <ParticipantStage 
          participants={[
            { id: '1', name: 'Ms. Tiff', isSpeaking: true, isReady: true, role: 'host', likes: 12 },
            { id: '2', name: 'Esta', isSpeaking: false, isReady: true, role: 'mod', isMuted: true },
            { id: '3', name: 'Phelo', isSpeaking: false, isReady: true, role: 'mod' },
            { id: '4', name: 'Marvin', isSpeaking: false, isReady: true, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Marvin' },
            { id: '5', name: 'Joyce', isSpeaking: false, isReady: true, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Joyce' }
          ]} 
        />

        <div className="room-controls-bar glass-effect">
           <button className="room-btn leave-btn" onClick={() => window.location.reload()}>Leave room</button>
           <div className="room-actions">
              <button className="action-circle-btn" title="Chat"><Activity size={20} /></button>
              <button className="action-circle-btn interaction-btn" onClick={() => setRoomLikes(l => l + 1)}>
                <Star size={20} className="icon-gold" />
                <span className="action-count">{roomLikes}</span>
              </button>
              <button className="action-circle-btn" title="Raise Hand"><ArrowRight size={20} style={{transform: 'rotate(-90deg)'}} /></button>
              <button className="action-circle-btn mic-toggle-btn" title="Mute/Unmute"><Mic size={20} /></button>
           </div>
        </div>

        <div className="stream-info-bar">
          <h1 className="stream-title">{streamInfo?.title || 'Live Stream'}</h1>
          <div className="stream-meta">
            <span className="stream-host">{streamInfo?.host_display_name}</span>
            <span className="stream-category">{streamInfo?.category_name}</span>
            <span className="viewer-count">👥 {streamInfo?.current_viewers || 0} viewers</span>
          </div>
        </div>

        {Object.keys(paymentHandles).length > 0 && (
          <PaymentButtons
            handles={paymentHandles}
            displayName={streamInfo?.host_display_name || 'Creator'}
            onPaymentClick={handlePaymentClick}
          />
        )}
      </div>

      <div className="stream-sidebar">
          <AIInsights summaries={aiSummaries} />

          {activeDonation && (
            <div className="donation-toast-v2 premium-shadow gold-border fade-in">
              <div className="donation-glow"></div>
              <div className="donation-content">
                <div className="donation-header">
                  <Star className="icon-gold bounce" size={24} />
                  <h3>NEW SIGNAL CONTRIBUTION</h3>
                </div>
                <div className="donation-amount">${activeDonation.amount}</div>
                <div className="donation-meta">
                  <span className="sender">{activeDonation.senderName}</span>
                  <p className="message">"{activeDonation.message}"</p>
                </div>
              </div>
            </div>
          )}

          <StreamTelemetry metrics={streamMetrics} />
        
          {pinnedItem && (
            <div className="pinned-item-overlay glass-effect fade-in">
              <div className="pinned-label">COMMERCIAL SIGNAL</div>
              <div className="pinned-content">
                <ShoppingBag size={14} className="icon-gold" />
                <span className="pinned-title">{pinnedItem.title}</span>
                <span className="pinned-price text-gold">${pinnedItem.price}</span>
                <button className="buy-btn-small premium-btn" onClick={() => setPinnedItem(null)}>STAKE</button>
              </div>
            </div>
          )}

        <ChatPanel 
          messages={chatMessages} 
          onSendMessage={handleSendMessage}
          currentUser={userId}
          hostId={streamInfo?.host_id}
        />
      </div>
    </div>
  );
};

// ============================================
// WATCH PARTY ROOM COMPONENT (Synchronized)
// ============================================

const WatchPartyRoom: React.FC<{
  partyId: string;
  userId: string;
  isHost: boolean;
  socket: Socket | null;
  onLeave: () => void;
}> = ({ partyId, userId, isHost, socket, onLeave }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [participants, setParticipants] = useState<{userId: string, isReady: boolean}[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); // Default demo
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('watch-party-joined', ({ playback, participants, partyData }) => {
      setIsPlaying(playback.isPlaying);
      setCurrentTime(playback.currentTime);
      setParticipants(participants);
      if (partyData?.videoUrl) setVideoUrl(partyData.videoUrl);
      
      // Sync player to current time on join
      if (playerRef.current) {
        playerRef.current.seekTo(playback.currentTime);
      }
    });

    socket.on('participant-joined', ({ userId }) => {
      setParticipants(prev => [...prev, { userId, isReady: false }]);
    });

    socket.on('playback-updated', ({ currentTime, isPlaying }) => {
      setIsPlaying(isPlaying);
      // Only seek if we are drifting by more than 2 seconds
      if (playerRef.current) {
        const drift = Math.abs(playerRef.current.getCurrentTime() - currentTime);
        if (drift > 2) {
          playerRef.current.seekTo(currentTime);
        }
      }
      setCurrentTime(currentTime);
    });

    socket.on('participant-ready-change', ({ userId: rUserId, isReady }) => {
      setParticipants(prev => prev.map(p => p.userId === rUserId ? { ...p, isReady } : p));
    });

    socket.on('ai-response', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    socket.emit('join-watch-party', { partyId, userId });

    return () => {
      socket.off('watch-party-joined');
      socket.off('participant-joined');
      socket.off('playback-updated');
      socket.off('participant-ready-change');
      socket.off('ai-response');
    };
  }, [socket, partyId, userId]);

  const toggleReady = () => {
    const newReady = !isReady;
    setIsReady(newReady);
    socket?.emit('watch-party-ready-status', { partyId, userId, isReady: newReady });
  };

  const syncPlayback = (newTime: number, playing: boolean) => {
    socket?.emit('watch-party-sync-playback', { partyId, currentTime: newTime, isPlaying: playing });
  };

  const handleAskAI = (prompt: string) => {
    socket?.emit('ask-party-ai', { partyId, prompt, userId, username: 'User', model: 'anthropic/claude-3.5-sonnet' });
  };

  return (
    <div className="watch-party-view fade-in">
      <div className="watch-party-main">
        <div className="video-container premium-shadow">
          <SafeReactPlayer
            ref={playerRef}
            url={videoUrl}
            playing={isPlaying}
            controls={isHost}
            width="100%"
            height="100%"
            onPlay={() => isHost && syncPlayback(playerRef.current?.getCurrentTime() || 0, true)}
            onPause={() => isHost && syncPlayback(playerRef.current?.getCurrentTime() || 0, false)}
            onProgress={(state: any) => {
              const { playedSeconds } = state;
              if (isHost && Math.abs(playedSeconds - currentTime) > 1) {
                syncPlayback(playedSeconds, isPlaying);
              }
            }}
            config={{
              youtube: { playerVars: { origin: window.location.origin } }
            } as any}
          />
          {!isHost && (
             <div className="playback-overlay">
               <span className="sync-status">
                 {isPlaying ? '● LIVE SYNC' : '■ PAUSED BY HOST'}
               </span>
               <button 
                 className="mini-sync-btn"
                 onClick={() => {
                   if (playerRef.current) {
                     playerRef.current.seekTo(currentTime);
                   }
                 }}
               >
                 RE-SYNC
               </button>
             </div>
          )}
        </div>

        <div className="ready-panel">
          <div className="ready-panel-header">
            <h3>Participants Ready Status</h3>
            <button 
              className={`ready-btn ${isReady ? 'active' : ''}`}
              onClick={toggleReady}
            >
              {isReady ? 'I am Ready!' : 'Set Ready'}
            </button>
          </div>
          
          <div className="participant-list">
            {participants.map(p => (
              <div key={p.userId} className={`participant-badge ${p.isReady ? 'ready' : ''}`}>
                <div className="ready-indicator"></div>
                <span>{p.userId === userId ? 'You' : p.userId}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="invite-section">
          <div>
            <span className="invite-label">Share Invite Code</span>
            <div className="invite-code">{partyId.toUpperCase()}</div>
          </div>
          <button className="payment-btn leave-party-btn" onClick={() => onLeave()}>
            Leave Party
          </button>
        </div>
      </div>

      <div className="stream-sidebar">
        <div className="chat-panel">
          <div className="chat-header">
            <h3>Watch Party Chat</h3>
            <div className="ai-controls">
              <button 
                className="ai-action-btn"
                onClick={() => handleAskAI("Summarize the vibes and key points of the chat so far.")}
                title="Summarize Chat"
              >
                <Activity size={14} />
              </button>
              <div className="ai-assistant-badge aura-pulse">AURA ACTIVE</div>
            </div>
          </div>
          <div className="chat-messages">
            {chatMessages.map((m, i) => (
              <div key={i} className={`chat-message ${m.userId === 'swani-ai' ? 'ai-glow' : ''} ${m.aiAction === 'flag' ? 'flagged' : ''}`}>
                <div className="chat-msg-header">
                  <span className="chat-username">{m.username}</span>
                  {m.userId === 'swani-ai' && <Zap size={10} className="icon-gold" />}
                  {m.aiAction === 'flag' && <Shield size={10} className="icon-red" />}
                </div>
                <p className="chat-text">
                   {m.aiAction === 'flag' ? `[MODERATED] ${m.message}` : m.message}
                </p>
              </div>
            ))}
            {chatMessages.length === 0 && (
              <div className="chat-notice-box">
                <Zap size={24} className="icon-gold" />
                <p>Aura AI is standing by. Ask about this stream!</p>
              </div>
            )}
          </div>
          <div className="chat-input-form">
            <input 
              type="text" 
              className="chat-input" 
              placeholder="Ask SWANI AI or type message..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAskAI((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// STREAM SETUP MODAL
// ============================================
const StreamSetupModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onStart: (config: { title: string; category: string; platforms: string[]; type: string }) => void;
}> = ({ isOpen, onClose, onStart }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Auction');
  const [streamType, setStreamType] = useState('panel');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['SeeWhy Live']);
  const [mediaStatus, setMediaStatus] = useState({ camera: 'granted', mic: 'granted' });
  const [isPrivate, setIsPrivate] = useState(false);
  const [ticketPrice, setTicketPrice] = useState(0);

  // IMMUTABLE - DO NOT CHANGE
  const PLATFORM_FEE_PCT = 0.10;
  
  // Calculate split preview
  const creatorAmount = ticketPrice * (1 - PLATFORM_FEE_PCT);
  const platformAmount = ticketPrice * PLATFORM_FEE_PCT;

  const platforms = ['SeeWhy Live', 'YouTube', 'Twitch', 'TikTok', 'Kick'];
  const streamTypes = [
    { id: 'single', label: 'Single Cam', icon: <Play size={20} /> },
    { id: 'panel', label: 'Panel', icon: <Users size={20} /> },
    { id: 'audio', label: 'Audio Room', icon: <Mic size={20} /> }
  ];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay fade-in">
      <div className="setup-modal-v2 glass-panel gold-border">
        <div className="modal-header-premium">
          <div className="uplink-icon aura-pulse">
            <Radio size={24} />
          </div>
          <h2>UPLINK INITIALIZATION</h2>
          <button className="close-modal-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-scroll-area">
          {/* Media Check Preview */}
          <div className="media-check-zone">
            <div className="preview-window">
              <div className="preview-overlay">
                <span className="preview-badge">PREVIEW</span>
              </div>
              <div className="scanline"></div>
            </div>
            <div className="media-status-grid">
              <div className={`status-pill ${mediaStatus.camera === 'granted' ? 'active' : ''}`}>
                <div className="status-indicator"></div>
                <span>CAMERA: ACCESS GRANTED</span>
              </div>
              <div className={`status-pill ${mediaStatus.mic === 'granted' ? 'active' : ''}`}>
                <div className="status-indicator"></div>
                <span>AUDIO: SIGNAL ACTIVE</span>
              </div>
            </div>
          </div>

          <div className="setup-sections">
            <section className="setup-group">
              <label>BROADCAST TITLE</label>
              <input 
                type="text" 
                placeholder="e.g. Late Night Chill Stream" 
                className="chat-input premium-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </section>

            <section className="setup-group">
              <label>SIGNAL ARCHITECTURE (STREAM TYPE)</label>
              <div className="type-selection-grid">
                {streamTypes.map(type => (
                  <button 
                    key={type.id}
                    className={`type-card ${streamType === type.id ? 'active' : ''}`}
                    onClick={() => setStreamType(type.id)}
                    title={`Select ${type.label}`}
                  >
                    {type.icon}
                    <span>{type.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="setup-group">
              <label>FAN-OUT MATRIX</label>
              <div className="platform-grid">
                {platforms.map(p => (
                  <button
                    key={p}
                    className={`platform-pill ${selectedPlatforms.includes(p) ? 'active' : ''}`}
                    onClick={() => {
                      if (selectedPlatforms.includes(p)) {
                        setSelectedPlatforms(selectedPlatforms.filter(item => item !== p));
                      } else {
                        setSelectedPlatforms([...selectedPlatforms, p]);
                      }
                    }}
                    title={`Stream to ${p}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </section>

            <div className="setup-row">
              <section className="setup-group half">
                <label>TICKET PRICE ($)</label>
                <div className="price-input-container">
                  <DollarSign size={14} />
                  <input 
                    type="number" 
                    className="chat-input price-input" 
                    value={ticketPrice}
                    onChange={(e) => setTicketPrice(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    aria-label="Ticket price"
                    title="Ticket price"
                  />
                </div>
                {ticketPrice > 0 && (
                  <div className="split-preview" style={{ marginTop: '8px' }}>
                    <div className="split-bar">
                      <div className="creator-portion"></div>
                      <div className="platform-portion"></div>
                    </div>
                    <div className="split-labels">
                      <span className="creator">You keep: ${creatorAmount.toFixed(2)}</span>
                      <span className="platform">Platform: ${platformAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </section>

              <section className="setup-group half">
                <label>PRIVACY ACCESS</label>
                <button 
                  className={`privacy-toggle ${isPrivate ? 'active' : ''}`}
                  onClick={() => setIsPrivate(!isPrivate)}
                  title="Toggle Privacy"
                >
                  <Shield size={16} />
                  <span>{isPrivate ? 'PRIVATE' : 'PUBLIC'}</span>
                </button>
              </section>
            </div>
          </div>
        </div>

        <div className="modal-footer-premium">
          <button className="cancel-uplink-btn" onClick={onClose}>ABORT</button>
          <button 
            className="start-uplink-btn-v2 aura-glow"
            disabled={!title}
            onClick={() => onStart({ title, category, platforms: selectedPlatforms, type: streamType })}
          >
            START UPLINK
          </button>
        </div>
      </div>
    </div>
  );
};


// ============================================
// MAIN APP COMPONENT
// ============================================

const App: React.FC = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [activePartyId, setActivePartyId] = useState<string | null>(null);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isStreamSetupOpen, setIsStreamSetupOpen] = useState(false);
  const [streamConfig, setStreamConfig] = useState<{title: string, category: string, platforms: string[]}>({
    title: '',
    category: 'Auction',
    platforms: []
  });
  console.log('Current Stream Config:', streamConfig);
  
  const userId = user?.id || 'anonymous';

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:3001', {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleJoinStream = (streamId: string) => {
    setActiveStreamId(streamId);
    setActivePartyId(null);
    setShowMarketplace(false);
    setIsHost(false);
  };

  const handleStartHostStream = async (config: { title: string; category: string; platforms: string[] }) => {
    try {
      const token = await getToken();
      
      // 1. Create Stream Resource
      const createRes = await fetch('/api/streams', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hostId: userId,
          title: config.title,
          category: config.category,
          visibility: 'PUBLIC'
        })
      });

      if (!createRes.ok) throw new Error("Failed to create stream uplink");
      const stream = await createRes.json();

      // 2. Activate Uplink & Fan-out
      const liveRes = await fetch(`/api/streams/${stream.id}/go-live`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          platforms: config.platforms.map(p => p.toLowerCase().replace(' (twitter)', ''))
        })
      });

      if (!liveRes.ok) throw new Error("Failed to initialize fan-out matrix");

      setStreamConfig(config);
      setIsStreamSetupOpen(false);
      setIsHost(true);
      setActiveStreamId(stream.id);
      setActivePartyId(null);
      setShowMarketplace(false);
    } catch (err: any) {
      console.error("[Stream Uplink Error]", err);
      alert(`SIGNAL ERROR: ${err.message}`);
    }
  };

  const handleJoinParty = (partyId: string) => {
    setActivePartyId(partyId);
    setActiveStreamId(null);
    setShowMarketplace(false);
    setIsHost(false);
  };

  const handleCreateParty = () => {
    const newId = `party-${Math.random().toString(36).substr(2, 6)}`;
    setActivePartyId(newId);
    setActiveStreamId(null);
    setShowMarketplace(false);
    setIsHost(true);
  };

  if (showMarketplace) {
    return <MarketplaceView userId={userId} onBack={() => setShowMarketplace(false)} getToken={getToken} />;
  }

  if (showDashboard) {
    return <CreatorDashboard onBack={() => setShowDashboard(false)} getToken={getToken} />;
  }

  return (
    <div className="app">
      {/* SeeWhy LIVE Scanline Overlay */}
      <div className="scanline-overlay" aria-hidden="true"></div>
      
      {!activeStreamId && !activePartyId ? (
        <div className="home-view">
          <header className="app-header">
            <div className="seewhy-header">
              <div className="seewhy-logo-mark">SW</div>
              <div className="seewhy-title">
                <h1>SEEWHY <span>LIVE</span></h1>
                <span className="tagline">SWANYTHREE ENTTECH</span>
              </div>
            </div>
            
            <div className="header-nav">
              {/* Status Pills */}
              <div className="status-pill obot">
                <span className="status-dot"></span>
                Obot
              </div>
              <div className="status-pill k8s">
                <span className="status-dot"></span>
                K8s
              </div>
              
              <SafeSignedIn>
                <button 
                  className="nav-btn dashboard-link"
                  onClick={() => setShowDashboard(true)}
                >
                  <Layout size={18} /> DASHBOARD
                </button>
              </SafeSignedIn>
              
              <button 
                className="nav-btn marketplace-link"
                onClick={() => setShowMarketplace(true)}
              >
                <ShoppingBag size={18} /> MARKETPLACE
              </button>

              <div className="auth-zone">
                <SafeSignedOut>
                  <SignInButton mode="modal">
                    <button className="auth-btn">JOIN SIGNAL</button>
                  </SignInButton>
                </SafeSignedOut>
                <SafeSignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SafeSignedIn>
              </div>
            </div>
          </header>

          {/* SeeWhy LIVE Ticker Bar */}
          <div className="seewhy-ticker">
            <div className="ticker-content">
              <span>SEEWHY LIVE — SwanyThree EntTech</span>
              <span>90/10 SPLIT — Creator keeps 90%</span>
              <span>RTMP FANOUT — YouTube · Twitch · TikTok · Kick</span>
              <span>GUARDIAN AI — Real-time moderation</span>
              <span>SEEWHY LIVE — SwanyThree EntTech</span>
              <span>90/10 SPLIT — Creator keeps 90%</span>
              <span>RTMP FANOUT — YouTube · Twitch · TikTok · Kick</span>
              <span>GUARDIAN AI — Real-time moderation</span>
            </div>
          </div>

          <div className="stream-browser">
            <div className="main-sections">
              <section>
                <h2>Live Streams</h2>
                <div className="stream-list">
                  <div className="stream-card" onClick={() => handleJoinStream('demo-stream-1')}>
                    <div className="stream-thumbnail">
                      <span className="live-badge">LIVE</span>
                    </div>
                    <div className="stream-details">
                      <h3>Gold Board Auction</h3>
                      <p>Featured Stream • 2.4k viewers</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="watch-parties-section">
                <h2>Watch Parties</h2>
                <div className="stream-list">
                  <div className="stream-card party-card" onClick={() => handleJoinParty('party-demo')}>
                    <div className="stream-thumbnail party-thumbnail">
                      <span className="live-badge party-badge">WATCH PARTY</span>
                    </div>
                    <div className="stream-details">
                      <h3>Movie Night with Fans</h3>
                      <p>Join synchronized playback</p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="host-section">
              <h2>Creator Tools</h2>
              <button 
                className="host-btn"
                onClick={() => setIsStreamSetupOpen(true)}
                aria-label="Initialize Live Stream"
                title="Initialize Live Stream"
              >
                Go Live
              </button>
              <button 
                className="host-btn start-party-btn"
                onClick={handleCreateParty}
                aria-label="Start Watch Party"
                title="Start Watch Party"
              >
                Start Watch Party
              </button>
              
              <div className="join-party-container gold-border-thin">
                <p className="join-party-label">SIGNAL ACCESS CODE</p>
                <div className="join-party-input-group">
                  <input 
                    type="text" 
                    placeholder="ENTER CODE" 
                    className="chat-input join-party-input" 
                    id="inviteCodeInput"
                  />
                  <button 
                    className="join-access-btn"
                    onClick={() => {
                      const code = (document.getElementById('inviteCodeInput') as HTMLInputElement).value;
                      if (code) handleJoinParty(code);
                    }}
                    title="Join with access code"
                    aria-label="Join with access code"
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (activeStreamId ? (
        socket && (
          <StreamView
            streamId={activeStreamId}
            userId={userId}
            isHost={isHost}
            socket={socket}
          />
        )
      ) : (
        socket && (
          <WatchPartyRoom
            partyId={activePartyId!}
            userId={userId}
            isHost={isHost}
            socket={socket}
            onLeave={() => setActivePartyId(null)}
          />
        )
      ))}

      <StreamSetupModal 
        isOpen={isStreamSetupOpen}
        onClose={() => setIsStreamSetupOpen(false)}
        onStart={handleStartHostStream}
      />
    </div>
  );
};

export default App;
