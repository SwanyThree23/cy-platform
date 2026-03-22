import React, { useState } from 'react';
import { 
  Users, 
  Radio, 
  DollarSign, 
  Shield, 
  Mic, 
  MicOff, 
  Star, 
  Power,
  RefreshCw,
  Eye,
  Volume2,
  VolumeX
} from 'lucide-react';

// IMMUTABLE - DO NOT CHANGE
const PLATFORM_FEE_PCT = 0.10;

interface Guest {
  id: string;
  name: string;
  avatar?: string;
  isMuted: boolean;
  isSpotlighted: boolean;
  platform: string;
}

interface GuardianLogEntry {
  timestamp: string;
  action: 'muted' | 'banned' | 'flagged';
  user: string;
  reason: string;
  confidence: number;
}

interface AdminStudioProps {
  streamId: string;
  onEndStream: () => void;
}

export const AdminStudio: React.FC<AdminStudioProps> = ({ streamId, onEndStream }) => {
  const [activeTab, setActiveTab] = useState<'panel' | 'fanout' | 'payments' | 'guardian'>('panel');
  const [fanoutEnabled, setFanoutEnabled] = useState(true);
  
  // Mock data for demonstration
  const [guests, setGuests] = useState<Guest[]>([
    { id: '1', name: 'SwanyThree', avatar: undefined, isMuted: false, isSpotlighted: true, platform: 'seewhy' },
    { id: '2', name: 'Danielle S.', avatar: undefined, isMuted: false, isSpotlighted: false, platform: 'youtube' },
    { id: '3', name: 'Johnny USA', avatar: undefined, isMuted: true, isSpotlighted: false, platform: 'twitch' },
  ]);

  const [guardianLogs] = useState<GuardianLogEntry[]>([
    { timestamp: '12:34:56', action: 'flagged', user: 'user_123', reason: 'Spam detected', confidence: 0.67 },
    { timestamp: '12:35:12', action: 'muted', user: 'troll_456', reason: 'Toxic language', confidence: 0.82 },
    { timestamp: '12:36:01', action: 'banned', user: 'bot_789', reason: 'Repeated violations', confidence: 0.96 },
  ]);

  const [paymentSimulator, setPaymentSimulator] = useState({
    amount: 25.00,
    type: 'tip' as 'tip' | 'paywall' | 'subscription'
  });

  // Calculate 90/10 split
  const totalCents = Math.round(paymentSimulator.amount * 100);
  const platformCents = Math.floor(totalCents * PLATFORM_FEE_PCT);
  const creatorCents = totalCents - platformCents;

  const toggleMute = (guestId: string) => {
    setGuests(guests.map(g => 
      g.id === guestId ? { ...g, isMuted: !g.isMuted } : g
    ));
  };

  const toggleSpotlight = (guestId: string) => {
    setGuests(guests.map(g => 
      g.id === guestId ? { ...g, isSpotlighted: !g.isSpotlighted } : g
    ));
  };

  const muteAll = () => {
    setGuests(guests.map(g => ({ ...g, isMuted: true })));
  };

  return (
    <div className="admin-studio">
      {/* Stats Row */}
      <div className="admin-stats-row">
        <div className="admin-stat-card">
          <span className="label">ON STAGE</span>
          <span className="value">{guests.length}</span>
        </div>
        <div className="admin-stat-card">
          <span className="label">VIEWERS</span>
          <span className="value">2,847</span>
        </div>
        <div className="admin-stat-card">
          <span className="label">BOT ACCURACY</span>
          <span className="value">98%</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="admin-tabs">
        <button 
          className={`admin-tab ${activeTab === 'panel' ? 'active' : ''}`}
          onClick={() => setActiveTab('panel')}
        >
          <Users size={14} /> Panel Stage
        </button>
        <button 
          className={`admin-tab ${activeTab === 'fanout' ? 'active' : ''}`}
          onClick={() => setActiveTab('fanout')}
        >
          <Radio size={14} /> RTMP Fanout
        </button>
        <button 
          className={`admin-tab ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          <DollarSign size={14} /> Payment Engine
        </button>
        <button 
          className={`admin-tab ${activeTab === 'guardian' ? 'active' : ''}`}
          onClick={() => setActiveTab('guardian')}
        >
          <Shield size={14} /> Guardian AI
        </button>
      </div>

      {/* Tab Content */}
      <div className="admin-tab-content">
        {activeTab === 'panel' && (
          <div className="panel-stage-tab">
            {/* Bulk Actions */}
            <div className="admin-actions">
              <button className={`admin-action-btn ${fanoutEnabled ? 'active' : ''}`} onClick={() => setFanoutEnabled(!fanoutEnabled)}>
                <Radio size={12} /> Fanout {fanoutEnabled ? 'ON' : 'OFF'}
              </button>
              <button className="admin-action-btn">
                <RefreshCw size={12} /> Sync All
              </button>
              <button className="admin-action-btn" onClick={muteAll}>
                <VolumeX size={12} /> Mute All
              </button>
              <button className="admin-action-btn danger" onClick={onEndStream}>
                <Power size={12} /> End Live
              </button>
            </div>

            {/* Guest Grid */}
            <div className="admin-guest-grid">
              {guests.map(guest => (
                <div key={guest.id} className={`admin-guest-card ${guest.isSpotlighted ? 'spotlighted' : ''}`}>
                  <div className="guest-avatar">
                    {guest.avatar ? (
                      <img src={guest.avatar} alt={guest.name} />
                    ) : (
                      <div className="avatar-placeholder">{guest.name[0]}</div>
                    )}
                    <span className={`platform-badge ${guest.platform}`}>{guest.platform.toUpperCase()}</span>
                  </div>
                  <div className="guest-info">
                    <span className="guest-name">{guest.name}</span>
                    <div className="guest-controls">
                      <button 
                        className={`control-btn ${guest.isSpotlighted ? 'active' : ''}`}
                        onClick={() => toggleSpotlight(guest.id)}
                        title="Toggle Spotlight"
                      >
                        <Star size={12} />
                      </button>
                      <button 
                        className={`control-btn ${guest.isMuted ? 'muted' : ''}`}
                        onClick={() => toggleMute(guest.id)}
                        title="Toggle Mute"
                      >
                        {guest.isMuted ? <MicOff size={12} /> : <Mic size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'fanout' && (
          <div className="fanout-tab">
            <div className="fanout-destinations">
              {[
                { platform: 'YouTube', status: 'live', viewers: 1234, color: 'var(--youtube)' },
                { platform: 'Twitch', status: 'live', viewers: 892, color: 'var(--twitch)' },
                { platform: 'TikTok', status: 'connecting', viewers: 0, color: 'var(--tiktok)' },
                { platform: 'Kick', status: 'offline', viewers: 0, color: 'var(--kick)' },
              ].map(dest => (
                <div key={dest.platform} className={`fanout-destination ${dest.status}`}>
                  <div className="dest-header">
                    <span className="dest-name" style={{ color: dest.color }}>{dest.platform}</span>
                    <span className={`dest-status ${dest.status}`}>{dest.status.toUpperCase()}</span>
                  </div>
                  {dest.status === 'live' && (
                    <div className="dest-viewers">
                      <Eye size={12} /> {dest.viewers.toLocaleString()} viewers
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="payments-tab">
            <div className="payment-simulator">
              <h4>Transaction Simulator</h4>
              <div className="simulator-input">
                <label>Amount ($)</label>
                <input 
                  type="number" 
                  value={paymentSimulator.amount}
                  onChange={(e) => setPaymentSimulator({ ...paymentSimulator, amount: parseFloat(e.target.value) || 0 })}
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="simulator-input">
                <label>Type</label>
                <select 
                  value={paymentSimulator.type}
                  onChange={(e) => setPaymentSimulator({ ...paymentSimulator, type: e.target.value as any })}
                >
                  <option value="tip">Tip</option>
                  <option value="paywall">Paywall Unlock</option>
                  <option value="subscription">Subscription</option>
                </select>
              </div>
            </div>

            <div className="payment-receipt">
              <h4>Receipt Preview</h4>
              <div className="receipt-row">
                <span>Total</span>
                <span>${paymentSimulator.amount.toFixed(2)}</span>
              </div>
              <div className="receipt-divider"></div>
              <div className="receipt-row creator">
                <span>Creator (90%)</span>
                <span>${(creatorCents / 100).toFixed(2)}</span>
              </div>
              <div className="receipt-row platform">
                <span>Platform (10%)</span>
                <span>${(platformCents / 100).toFixed(2)}</span>
              </div>
              <div className="receipt-footer">
                <code>PLATFORM_FEE_PCT = 0.10</code>
                <span className="immutable-badge">IMMUTABLE</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'guardian' && (
          <div className="guardian-tab">
            {/* Threshold Meters */}
            <div className="threshold-meters">
              <div className="threshold-meter flag">
                <span className="label">FLAG</span>
                <div className="bar"><div className="fill"></div></div>
                <span className="value">0.50</span>
              </div>
              <div className="threshold-meter mute">
                <span className="label">MUTE</span>
                <div className="bar"><div className="fill"></div></div>
                <span className="value">0.75</span>
              </div>
              <div className="threshold-meter ban">
                <span className="label">BAN</span>
                <div className="bar"><div className="fill"></div></div>
                <span className="value">0.95</span>
              </div>
            </div>

            {/* Activity Log */}
            <div className="guardian-terminal">
              {guardianLogs.map((log, i) => (
                <div key={i} className="guardian-log-entry">
                  <span className="timestamp">[{log.timestamp}]</span>
                  <span className={`action ${log.action}`}>{log.action.toUpperCase()}</span>
                  <span className="user">{log.user}</span>
                  <span className="reason">- {log.reason}</span>
                  <span className="confidence">({(log.confidence * 100).toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminStudio;
