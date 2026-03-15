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
  Shield, 
  Zap, 
  DollarSign, 
  Play, 
  Plus, 
  Settings, 
  Layout, 
  ShoppingBag,
  ExternalLink,
  Users
} from 'lucide-react';
import './App.css';
import { CreatorDashboard } from './CreatorDashboard';

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
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
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
                  <button className="play-overlay"><Play fill="white" size={32} /></button>
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
// CREATOR DASHBOARD COMPONENT
// ============================================

const CreatorDashboard: React.FC<{
  onBack: () => void;
  getToken: () => Promise<string | null>;
}> = ({ onBack, getToken }) => {
  const { user } = useUser();
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStartOnboarding = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/creators/onboard', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Onboarding failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-view">
      <header className="marketplace-header glass-effect">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="header-title-group">
          <Layout className="icon-gold" />
          <h2 className="glow-text">CREATOR COMMAND</h2>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-grid">
          {/* Revenue Panel */}
          <div className="dashboard-panel gold-border">
            <div className="panel-header">
              <DollarSign className="icon-gold" />
              <h3>REVENUE OPERATIONS</h3>
            </div>
            <div className="revenue-stats">
              <div className="big-stat">
                <span className="stat-label">TOTAL EARNINGS</span>
                <span className="stat-value">$0.00</span>
              </div>
              <div className="big-stat">
                <span className="stat-label">PLATFORM FEES PAID</span>
                <span className="stat-value">$0.00</span>
              </div>
            </div>
            <div className="stripe-status">
              <p>Enable direct-to-bank payouts via Stripe Connect.</p>
              <button 
                className="host-btn stripe-btn" 
                onClick={handleStartOnboarding}
                disabled={loading}
              >
                {loading ? 'CONNECTING...' : 'SETUP DIRECT PAYOUTS'}
              </button>
            </div>
          </div>

          {/* Stream Settings */}
          <div className="dashboard-panel gold-border">
            <div className="panel-header">
              <Zap className="icon-red" />
              <h3>SIGNAL CONFIGURATION</h3>
            </div>
            <div className="setting-item">
              <label>RTMP ENDPOINT</label>
              <div className="input-copy-group">
                <input readOnly value="rtmp://35.147.110.1:1935/live" className="chat-input" />
                <button className="copy-btn">COPY</button>
              </div>
            </div>
            <div className="setting-item">
              <label>STREAM KEY</label>
              <div className="input-copy-group">
                <input type="password" readOnly value="CY_LIVE_••••••••••••" className="chat-input" />
                <button className="copy-btn">REVEAL</button>
              </div>
            </div>
            <div className="security-notice">
              <Shield size={14} />
              <span>Keys are encrypted with AES-256-CBC.</span>
            </div>
          </div>

          {/* User Management */}
          <div className="dashboard-panel gold-border full-width">
            <div className="panel-header">
              <Users className="icon-gold" />
              <h3>FAN BASE</h3>
            </div>
            <div className="fan-metrics">
              <div className="fan-stat">
                <h3>0</h3>
                <p>FOLLOWERS</p>
              </div>
              <div className="fan-stat">
                <h3>0</h3>
                <p>SUBSCRIPTIONS</p>
              </div>
              <div className="fan-stat">
                <h3>0</h3>
                <p>WHALES</p>
              </div>
            </div>
          </div>
        </div>
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
    <div className="gold-board-grid">
      {/* Host Panel - Top Left with Gold Border */}
      <div className="host-panel gold-border">
        <div className="panel-label">HOST</div>
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
            <div key={guest.id} className="guest-panel">
              <div className="panel-label">GUEST {guest.gridPosition + 1}</div>
              <video
                ref={(el) => setGuestVideoRef(guest.id, el)}
                autoPlay
                playsInline
                className="video-element"
              />
              <div className="guest-info">
                <span className="guest-name">{guest.username}</span>
              </div>
            </div>
          ))}

          {/* Empty Slots */}
          {Array.from({ length: Math.max(0, 20 - guests.length) }).map((_, index) => (
            <div key={`empty-${index}`} className="guest-panel empty">
              <div className="panel-label">SLOT {guests.length + index + 1}</div>
              <div className="video-placeholder">
                <span className="slot-number">{guests.length + index + 1}</span>
              </div>
              {!isHost && !currentGuestId && (
                <button 
                  className="join-slot-btn"
                  onClick={onJoinAsGuest}
                >
                  Join Panel
                </button>
              )}
            </div>
          ))}
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
      <h3 className="payment-title">💰 Support {displayName}</h3>
      <p className="payment-subtitle">100% goes to creator • 0% platform fee</p>
      
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
}> = ({ messages, onSendMessage, currentUser }) => {
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
        <span className="chat-badge">AI Moderated</span>
      </div>
      
      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message ${msg.userId === currentUser ? 'own' : ''}`}
          >
            <span className="chat-username">{msg.username}</span>
            <span className="chat-text">{msg.message}</span>
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

    return () => {
      socket.off('joined-stream');
      socket.off('chat-message');
      socket.off('guest-joined-panel');
      socket.off('guest-left-panel');
      socket.off('new-producer');
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
        <ChatPanel
          messages={chatMessages}
          onSendMessage={handleSendMessage}
          currentUser={userId}
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

  useEffect(() => {
    if (!socket) return;

    socket.on('watch-party-joined', ({ playback, participants }) => {
      setIsPlaying(playback.isPlaying);
      setCurrentTime(playback.currentTime);
      setParticipants(participants);
    });

    socket.on('participant-joined', ({ userId }) => {
      setParticipants(prev => [...prev, { userId, isReady: false }]);
    });

    socket.on('playback-updated', ({ currentTime, isPlaying }) => {
      setCurrentTime(currentTime);
      setIsPlaying(isPlaying);
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
    <div className="watch-party-view">
      <div className="watch-party-main">
        <div className="video-container gold-border">
          <div className="video-placeholder">
            <span className="live-indicator">SYNCHRONIZED PLAYBACK</span>
            <p>Video ID: {partyId} • {isPlaying ? 'Playing' : 'Paused'} • {Math.floor(currentTime)}s</p>
          </div>
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
            <div className="ai-assistant-badge">AI ASSISTANT READY</div>
          </div>
          <div className="chat-messages">
            {chatMessages.map((m, i) => (
              <div key={i} className={`chat-message ${m.userId === 'swani-ai' ? 'ai' : ''}`}>
                <span className="chat-username">{m.username}</span>
                <p className="chat-text">{m.message}</p>
              </div>
            ))}
            {chatMessages.length === 0 && (
              <div className="chat-notice">Ask SWANI AI for info about the video!</div>
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
  
  const userId = user?.id || 'anonymous';
  const userDisplayName = user?.username || user?.firstName || 'Guest';

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
      {!activeStreamId && !activePartyId ? (
        <div className="home-view">
          <header className="app-header">
            <div className="header-brand">
              <h1 className="app-logo">CY LIVE</h1>
              <p className="app-tagline">SIGNAL OVER NOISE</p>
            </div>
            
            <div className="header-nav">
              <SignedIn>
                <button 
                  className="nav-btn dashboard-link"
                  onClick={() => setShowDashboard(true)}
                >
                  <Layout size={18} /> DASHBOARD
                </button>
              </SignedIn>
              
              <button 
                className="nav-btn marketplace-link"
                onClick={() => setShowMarketplace(true)}
              >
                <ShoppingBag size={18} /> MARKETPLACE
              </button>

              <div className="auth-zone">
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="auth-btn">JOIN SIGNAL</button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </div>
            </div>
          </header>


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
                onClick={() => handleJoinStream('host-stream')}
              >
                Go Live
              </button>
              <button 
                className="host-btn start-party-btn"
                onClick={handleCreateParty}
              >
                Start Watch Party
              </button>
              
              <div className="join-party-container">
                <p className="join-party-label">Join by Invite Code</p>
                <div className="join-party-input-group">
                  <input type="text" placeholder="CODE" className="chat-input join-party-input" />
                  <button className="chat-send-btn">➔</button>
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
    </div>
  );
};

export default App;
