import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Settings, 
  Key, 
  Radio, 
  RefreshCw, 
  Copy, 
  Check, 
  Terminal, 
  Activity,
  User,
  Zap,
  Bot
} from 'lucide-react';
import './CreatorDashboard.css';

interface CreatorProfile {
  id: string;
  handle: string;
  displayName: string;
  email: string;
  rtmpKey?: string;
  rtmpSecret?: string;
  plan: string;
  auraEnabled: boolean;
  auraVoice: string;
  auraAutoSummary: boolean;
}

export const CreatorDashboard: React.FC<{ 
  onBack: () => void; 
  getToken: () => Promise<string | null>;
}> = ({ onBack, getToken }) => {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'key' | 'secret' | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/creator/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setProfile(await res.json());
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, type: 'key' | 'secret') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateKeys = async () => {
    if (!window.confirm("Are you sure? This will invalidate your current stream keys.")) return;
    setIsUpdating(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/creator/generate-keys', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const { rtmpKey, rtmpSecret } = await res.json();
        setProfile((prev) => prev ? { ...prev, rtmpKey, rtmpSecret } : null);
      }
    } catch (err) {
      console.error("Error generating keys:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleAura = async (field: 'auraEnabled' | 'auraAutoSummary', value: boolean) => {
    if (!profile) return;
    const previous = { ...profile };
    setProfile({ ...profile, [field]: value });
    try {
      const token = await getToken();
      await fetch('/api/creator/profile', {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [field]: value })
      });
    } catch (err) {
      setProfile(previous);
      alert("Failed to update settings");
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <Activity className="spinner-icon" />
        <p className="glow-text">Bypassing Security... Connecting to Mainframe</p>
      </div>
    );
  }

  if (!profile) return <div className="dashboard-error">No profile found.</div>;

  return (
    <div className="creator-dashboard fade-in">
      <header className="dashboard-header glass-panel">
        <button className="back-btn outline-hover" onClick={onBack}>← RETURN</button>
        <div className="header-title">
          <Terminal size={24} className="icon-gold" />
          <h2 className="gradient-text">CREATOR COMMAND CENTER</h2>
        </div>
        <div className="user-badge">
          <span className="badge-handle">@{profile.handle}</span>
          <span className="badge-plan">{profile.plan}</span>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Stream Configuration Panel */}
        <section className="dashboard-card glass-panel config-panel">
          <div className="card-header">
            <Radio className="icon-orange" />
            <h3>Broadcast Uplink</h3>
          </div>
          <div className="card-body">
            <p className="subtext">Configure your OBS or streaming software.</p>
            
            <div className="form-group">
              <label>RTMP Server URL</label>
              <div className="copy-input-wrapper">
                <input type="text" readOnly value="rtmp://stream.swanythree.live:1935/live" className="mono-input" aria-label="RTMP Server URL" />
                <button className="icon-btn" onClick={() => handleCopy("rtmp://stream.swanythree.live:1935/live", 'key')} aria-label="Copy RTMP URL">
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Stream Key (Keep secret!)</label>
              <div className="copy-input-wrapper">
                <input 
                  type="password" 
                  readOnly 
                  value={profile.rtmpKey || "Not generated yet"} 
                  className="mono-input accent-input" 
                  aria-label="RTMP Stream Key"
                />
                <button className="icon-btn" disabled={!profile.rtmpKey} onClick={() => handleCopy(profile.rtmpKey || "", 'secret')} aria-label="Copy Stream Key">
                  {copied === 'secret' ? <Check size={16} color="#00ff7a" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <button className="cyber-btn primary-btn" onClick={generateKeys} disabled={isUpdating}>
              <RefreshCw size={16} className={isUpdating ? "spin" : ""} />
              {profile.rtmpKey ? "ROLL NEW KEYS" : "GENERATE INIT KEYS"}
            </button>
          </div>
        </section>

        {/* AI & Aura settings */}
        <section className="dashboard-card glass-panel ai-panel">
          <div className="card-header">
            <Bot className="icon-gold" />
            <h3>Aura AI Copilot</h3>
          </div>
          <div className="card-body">
            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Aura Live Moderation</h4>
                <p>Auto-ban toxic chat terms & handle spam.</p>
              </div>
              <label className="cyber-switch">
                <input 
                  type="checkbox" 
                  checked={profile.auraEnabled} 
                  onChange={(e) => toggleAura('auraEnabled', e.target.checked)} 
                  aria-label="Toggle Aura Live Moderation"
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="toggle-row">
              <div className="toggle-info">
                <h4>Auto-Summary Highlights</h4>
                <p>Generate a VOD summary & clips post-stream.</p>
              </div>
              <label className="cyber-switch">
                <input 
                  type="checkbox" 
                  checked={profile.auraAutoSummary} 
                  onChange={(e) => toggleAura('auraAutoSummary', e.target.checked)} 
                  aria-label="Toggle Auto-Summary Highlights"
                />
                <span className="slider"></span>
              </label>
            </div>
            
            {profile.auraEnabled && (
              <div className="form-group aura-voice">
                <label>Aura Persona Voice</label>
                <select className="cyber-select" defaultValue={profile.auraVoice} aria-label="Select Aura Persona Voice">
                  <option value="onyx">Onyx (Deep/Professional)</option>
                  <option value="echo">Echo (Digital/Swift)</option>
                  <option value="nova">Nova (Bright/Energetic)</option>
                </select>
              </div>
            )}
          </div>
        </section>

        {/* Metrics Overview */}
        <section className="dashboard-card glass-panel metrics-panel">
          <div className="card-header">
            <BarChart3 className="icon-green" />
            <h3>Live Telemetry</h3>
          </div>
          <div className="card-body telemetry-grid">
            <div className="metric-box">
              <span className="metric-label">Total Views (7d)</span>
              <span className="metric-value">12,408</span>
              <span className="metric-trend positive">+14%</span>
            </div>
            <div className="metric-box">
              <span className="metric-label">Peak Concurrent</span>
              <span className="metric-value">412</span>
            </div>
            <div className="metric-box highlight">
              <span className="metric-label">Total Revenue</span>
              <span className="metric-value">$840.50</span>
              <span className="metric-trend positive">0% Platform Fee</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
