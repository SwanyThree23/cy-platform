import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Zap, 
  Shield, 
  Globe, 
  AlertTriangle,
  Youtube,
  Twitch,
  Radio,
  Bot
} from 'lucide-react';

// IMMUTABLE - DO NOT CHANGE
const PLATFORM_FEE_PCT = 0.10;

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
  platform: 'seewhy' | 'youtube' | 'twitch' | 'tiktok' | 'kick';
  isSwanyBot?: boolean;
  toxicityScore?: number;
  aiAction?: 'allow' | 'flag' | 'mute' | 'ban';
}

interface SwanyBotProps {
  streamId: string;
  currentUserId: string;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onBotCommand: (command: string) => void;
}

// Toxicity thresholds (IMMUTABLE)
const TOXICITY_THRESHOLDS = {
  FLAG: 0.50,
  MUTE: 0.75,
  BAN: 0.95
};

// Platform icon mapping
const PlatformIcon: React.FC<{ platform: string }> = ({ platform }) => {
  switch (platform) {
    case 'youtube': return <Youtube size={10} className="platform-icon youtube" />;
    case 'twitch': return <Twitch size={10} className="platform-icon twitch" />;
    case 'tiktok': return <span className="platform-icon tiktok">TT</span>;
    case 'kick': return <Radio size={10} className="platform-icon kick" />;
    default: return <Radio size={10} className="platform-icon seewhy" />;
  }
};

// Toxicity badge component
const ToxicityBadge: React.FC<{ score: number }> = ({ score }) => {
  let level: 'low' | 'medium' | 'high' = 'low';
  if (score >= TOXICITY_THRESHOLDS.MUTE) level = 'high';
  else if (score >= TOXICITY_THRESHOLDS.FLAG) level = 'medium';

  return (
    <span className={`toxicity-pill ${level}`} title={`Toxicity: ${(score * 100).toFixed(0)}%`}>
      {(score * 100).toFixed(0)}%
    </span>
  );
};

// SwanyBot commands
const SWANYBOT_COMMANDS = [
  { cmd: '!hype', desc: 'Generate hype message' },
  { cmd: '!split', desc: 'Show revenue split (90/10)' },
  { cmd: '!paywall', desc: 'Paywall status' },
  { cmd: '!platforms', desc: 'Active RTMP destinations' },
  { cmd: '!tip', desc: 'How to send tips' },
  { cmd: '!guardian', desc: 'Guardian AI status' },
];

export const SwanyBot: React.FC<SwanyBotProps> = ({
  streamId,
  currentUserId,
  messages,
  onSendMessage,
  onBotCommand
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [languageFilter, setLanguageFilter] = useState<string>('ALL');
  const [modelSelector, setModelSelector] = useState<string>('llama-3-mini');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    // Check for bot commands
    if (inputMessage.startsWith('!')) {
      onBotCommand(inputMessage);
    } else {
      onSendMessage(inputMessage);
    }
    
    setInputMessage('');
    setShowCommands(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputMessage(value);
    setShowCommands(value.startsWith('!') && value.length > 0);
  };

  const filteredCommands = SWANYBOT_COMMANDS.filter(
    cmd => cmd.cmd.toLowerCase().includes(inputMessage.toLowerCase())
  );

  return (
    <div className="swanybot-chat">
      {/* Chat Header */}
      <div className="swanybot-header">
        <div className="header-left">
          <Bot size={16} className="bot-icon" />
          <h3>SeeWhy Chat</h3>
          <span className="swanybot-badge">
            <Zap size={8} /> SwanyBot
          </span>
        </div>
        <div className="header-controls">
          <select 
            className="language-filter"
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
          >
            <option value="ALL">ALL</option>
            <option value="EN">EN</option>
            <option value="ES">ES</option>
            <option value="FR">FR</option>
          </select>
          <select
            className="model-selector"
            value={modelSelector}
            onChange={(e) => setModelSelector(e.target.value)}
          >
            <option value="llama-3-mini">Llama 3 Mini</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gpt-4o">GPT-4o</option>
          </select>
        </div>
      </div>

      {/* Platform Aggregation Legend */}
      <div className="platform-legend">
        <span className="legend-label">Platforms:</span>
        <span className="legend-item seewhy"><Radio size={10} /> SW</span>
        <span className="legend-item youtube"><Youtube size={10} /> YT</span>
        <span className="legend-item twitch"><Twitch size={10} /> TW</span>
        <span className="legend-item tiktok">TT</span>
      </div>

      {/* Messages */}
      <div className="swanybot-messages">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`swanybot-message ${msg.isSwanyBot ? 'swanybot-message' : ''} ${msg.aiAction === 'flag' ? 'flagged' : ''}`}
          >
            <div className="message-header">
              <PlatformIcon platform={msg.platform} />
              <span className={`username ${msg.isSwanyBot ? 'bot-name' : ''}`}>
                {msg.username}
              </span>
              {msg.isSwanyBot && (
                <span className="swanybot-badge">
                  <Zap size={8} /> BOT
                </span>
              )}
              {msg.toxicityScore !== undefined && msg.toxicityScore >= TOXICITY_THRESHOLDS.FLAG && (
                <ToxicityBadge score={msg.toxicityScore} />
              )}
              {msg.aiAction === 'flag' && (
                <Shield size={10} className="flagged-icon" />
              )}
            </div>
            <div className="message-content">
              {msg.aiAction === 'flag' ? (
                <span className="flagged-text">
                  <AlertTriangle size={10} /> Message flagged by Guardian AI
                </span>
              ) : (
                msg.message
              )}
            </div>
            <span className="message-time">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Command Suggestions */}
      {showCommands && filteredCommands.length > 0 && (
        <div className="command-suggestions">
          {filteredCommands.map(cmd => (
            <button
              key={cmd.cmd}
              className="command-suggestion"
              onClick={() => {
                setInputMessage(cmd.cmd);
                setShowCommands(false);
              }}
            >
              <code>{cmd.cmd}</code>
              <span>{cmd.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form className="swanybot-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputMessage}
          onChange={handleInputChange}
          placeholder="Type message or !command..."
          className="swanybot-input"
          maxLength={300}
        />
        <button type="submit" className="swanybot-send-btn">
          <Send size={16} />
        </button>
      </form>

      {/* Quick Commands */}
      <div className="quick-commands">
        {SWANYBOT_COMMANDS.slice(0, 4).map(cmd => (
          <button
            key={cmd.cmd}
            className="quick-command-btn"
            onClick={() => {
              onBotCommand(cmd.cmd);
            }}
          >
            {cmd.cmd}
          </button>
        ))}
      </div>
    </div>
  );
};

// SwanyBot Response Generator (for demo purposes)
export const generateSwanyBotResponse = (command: string): string => {
  const responses: Record<string, string> = {
    '!hype': 'Let\'s GO! The energy in this stream is INCREDIBLE! Drop some love in the chat!',
    '!split': `Revenue Split: Creator keeps 90% | Platform fee: 10% | PLATFORM_FEE_PCT = ${PLATFORM_FEE_PCT} (IMMUTABLE)`,
    '!paywall': 'Paywall Status: ACTIVE | Free preview: 120s | Support the creator to unlock premium content!',
    '!platforms': 'Active Fanout: YouTube (LIVE) | Twitch (LIVE) | TikTok (CONNECTING) | Total reach: 4,200+ viewers',
    '!tip': 'To send a tip, click the Tips tab! 90% goes directly to the creator. Every tip matters!',
    '!guardian': 'Guardian AI: ONLINE | Thresholds: FLAG=0.50, MUTE=0.75, BAN=0.95 | Accuracy: 98.2%',
  };

  return responses[command] || 'Unknown command. Try !hype, !split, !paywall, !platforms, !tip, or !guardian';
};

export default SwanyBot;
