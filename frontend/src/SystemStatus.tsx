import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Database, Zap, CheckCircle2, AlertCircle } from 'lucide-react';

interface HealthData {
  status: string;
  timestamp: string;
  services: {
    database: string;
    mediasoup: string;
  };
}

const SystemStatus: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError("API unreachable");
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
    const timer = setInterval(checkHealth, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="system-status-container">
      <div className="status-grid">
        <div className={`status-card ${health?.status === 'healthy' ? 'healthy' : 'degraded'}`}>
          <div className="status-header">
            <Activity className="status-icon" />
            <h3>FULLSTACK STABILITY</h3>
            <span className="pulse-dot"></span>
          </div>
          
          <div className="service-list">
            <div className="service-item">
              <Database className="service-icon" />
              <span>CORE DATABASE</span>
              <span className={`status-label ${health?.services.database === 'connected' ? 'bg-green' : 'bg-red'}`}>
                {health?.services.database || 'DISCONNECTED'}
              </span>
            </div>
            
            <div className="service-item">
              <Zap className="service-icon" />
              <span>SFU (WEBRTC)</span>
              <span className={`status-label ${health?.services.mediasoup === 'running' ? 'bg-green' : 'bg-red'}`}>
                {health?.services.mediasoup || 'STOPPED'}
              </span>
            </div>

            <div className="service-item">
              <ShieldCheck className="service-icon" />
              <span>IDENTITY (CLERK)</span>
              <span className="status-label bg-green">ACTIVE</span>
            </div>
          </div>

          <div className="status-footer">
            {error ? (
              <div className="error-badge">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            ) : (
              <div className="success-badge">
                <CheckCircle2 size={14} />
                <span>SYSTEMS NOMINAL</span>
              </div>
            )}
            <span className="timestamp">{new Date(health?.timestamp || Date.now()).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      <style>{`
        .system-status-container {
          padding: 20px;
          color: white;
          font-family: 'Outfit', sans-serif;
        }
        .status-card {
          background: rgba(10, 10, 10, 0.8);
          border: 1px solid rgba(255, 122, 0, 0.3);
          border-radius: 12px;
          padding: 24px;
          backdrop-filter: blur(10px);
          max-width: 400px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        .status-card.healthy {
          border-color: rgba(0, 255, 122, 0.3);
        }
        .status-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          position: relative;
        }
        .status-icon { color: #ff7a00; }
        .healthy .status-icon { color: #00ff7a; }
        .status-header h3 {
          font-size: 0.9rem;
          letter-spacing: 2px;
          margin: 0;
          color: #aaa;
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #00ff7a;
          border-radius: 50%;
          position: absolute;
          right: 0;
          box-shadow: 0 0 10px #00ff7a;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        .service-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .service-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.8rem;
          color: #eee;
        }
        .service-icon { size: 16px; color: #555; }
        .status-label {
          margin-left: auto;
          font-size: 0.65rem;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: bold;
          letter-spacing: 1px;
        }
        .bg-green { background: rgba(0, 255, 122, 0.1); color: #00ff7a; border: 1px solid rgba(0, 255, 122, 0.2); }
        .bg-red { background: rgba(255, 0, 0, 0.1); color: #ff4d4d; border: 1px solid rgba(255, 0, 0, 0.2); }
        .status-footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .success-badge, .error-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.7rem;
          font-weight: bold;
          color: #00ff7a;
        }
        .error-badge { color: #ff4d4d; }
        .timestamp { font-size: 0.65rem; color: #555; }
      `}</style>
    </div>
  );
};

export default SystemStatus;
