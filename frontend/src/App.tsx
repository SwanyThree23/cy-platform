import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Device } from 'mediasoup-client';
import { io, Socket } from 'socket.io-client';
import './App.css';

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
}> = ({ 
  streamId, 
  isHost, 
  userId, 
  localStream, 
  guests, 
  onJoinAsGuest,
  onLeaveAsGuest,
  currentGuestId 
}) => {
  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const guestVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    if (hostVideoRef.current && localStream) {
      hostVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

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
                className="payment-btn zelle"
                style={{ backgroundColor: method.color }}
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
              className="payment-btn"
              style={{ backgroundColor: method.color }}
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
  const [guests, setGuests] = useState<Guest[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [paymentHandles, setPaymentHandles] = useState<PaymentHandle>({});
  const [streamInfo, setStreamInfo] = useState<Stream | null>(null);
  const [currentGuestId, setCurrentGuestId] = useState<string>();
  const [device, setDevice] = useState<Device | null>(null);
  const [sendTransport, setSendTransport] = useState<any>(null);
  const [recvTransports, setRecvTransports] = useState<Map<string, any>>(new Map());

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
      console.log('[Socket] New producer:', producerId, kind);
      // Create consumer for the new producer
      await createConsumer(producerId);
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
  const createConsumer = async (producerId: string) => {
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
          
          // Find the guest video element and set the stream
          // This is simplified - in production you'd track which producer belongs to which guest
          console.log('[Mediasoup] Consuming stream from producer:', producerId);
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
// MAIN APP COMPONENT
// ============================================

const App: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [userId] = useState(() => `user-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:3001', {
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleJoinStream = (streamId: string) => {
    setActiveStreamId(streamId);
    setIsHost(false);
  };

  const handleHostStream = (streamId: string) => {
    setActiveStreamId(streamId);
    setIsHost(true);
  };

  return (
    <div className="app">
      {!activeStreamId ? (
        <div className="home-view">
          <header className="app-header">
            <h1 className="app-logo">CY Platform</h1>
            <p className="app-tagline">Zero-Fee Live Streaming • 20-Guest Panels • Cross-Platform</p>
          </header>

          <div className="stream-browser">
            <h2>Live Streams</h2>
            {/* Stream list would be fetched from API */}
            <div className="stream-list">
              <div className="stream-card" onClick={() => handleJoinStream('demo-stream-1')}>
                <div className="stream-thumbnail">
                  <span className="live-badge">LIVE</span>
                </div>
                <div className="stream-details">
                  <h3>Demo Stream</h3>
                  <p>Click to join as viewer</p>
                </div>
              </div>
            </div>

            <div className="host-section">
              <h2>Start Streaming</h2>
              <button 
                className="host-btn"
                onClick={() => handleHostStream('new-stream')}
              >
                Go Live
              </button>
            </div>
          </div>
        </div>
      ) : (
        socket && (
          <StreamView
            streamId={activeStreamId}
            userId={userId}
            isHost={isHost}
            socket={socket}
          />
        )
      )}
    </div>
  );
};

export default App;
