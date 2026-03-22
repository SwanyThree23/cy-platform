import React, { useState } from 'react';
import { DollarSign, Send, Heart } from 'lucide-react';

// IMMUTABLE - DO NOT CHANGE
const PLATFORM_FEE_PCT = 0.10;

interface TipsTabProps {
  creatorName: string;
  creatorId: string;
  onSendTip: (amount: number, message: string) => void;
}

const TIP_AMOUNTS = [1, 5, 10, 25, 50, 100];

export const TipsTab: React.FC<TipsTabProps> = ({ creatorName, creatorId, onSendTip }) => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const tipAmount = selectedAmount || parseFloat(customAmount) || 0;
  
  // Calculate 90/10 split - Math.floor to ensure platform never overcharges
  const totalCents = Math.round(tipAmount * 100);
  const platformCents = Math.floor(totalCents * PLATFORM_FEE_PCT);
  const creatorCents = totalCents - platformCents;

  const handleSendTip = async () => {
    if (tipAmount <= 0) return;
    
    setIsSending(true);
    try {
      await onSendTip(tipAmount, message);
      setSelectedAmount(null);
      setCustomAmount('');
      setMessage('');
    } catch (error) {
      console.error('Tip failed:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="tips-tab">
      <div className="tips-header">
        <Heart className="tips-icon" />
        <h3>Support {creatorName}</h3>
        <p className="tips-subtitle">90% goes directly to the creator</p>
      </div>

      {/* 90/10 Split Visualization */}
      <div className="split-display">
        <div className="split-bar">
          <div className="creator-portion" style={{ width: '90%' }}></div>
          <div className="platform-portion" style={{ width: '10%' }}></div>
        </div>
        <div className="split-labels">
          <span className="creator">Creator 90%</span>
          <span className="platform">Platform 10%</span>
        </div>
      </div>

      {/* Current Earnings Preview */}
      {tipAmount > 0 && (
        <div className="earnings-preview">
          <div className="earnings-amount">
            <span className="label">Creator receives:</span>
            <span className="value creator">${(creatorCents / 100).toFixed(2)}</span>
          </div>
          <div className="earnings-amount">
            <span className="label">Platform fee:</span>
            <span className="value platform">${(platformCents / 100).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Quick Tip Amounts */}
      <div className="tip-amounts">
        {TIP_AMOUNTS.map((amount) => (
          <button
            key={amount}
            className={`tip-btn ${selectedAmount === amount ? 'selected' : ''}`}
            onClick={() => {
              setSelectedAmount(amount);
              setCustomAmount('');
            }}
          >
            ${amount}
          </button>
        ))}
      </div>

      {/* Custom Amount */}
      <div className="custom-tip-input">
        <DollarSign size={16} className="input-icon" />
        <input
          type="number"
          placeholder="Custom amount"
          value={customAmount}
          onChange={(e) => {
            setCustomAmount(e.target.value);
            setSelectedAmount(null);
          }}
          min="1"
          step="0.01"
        />
      </div>

      {/* Tip Message */}
      <div className="tip-message-input">
        <textarea
          placeholder="Add a message (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={200}
          rows={2}
        />
      </div>

      {/* Send Button */}
      <button 
        className="send-tip-btn"
        onClick={handleSendTip}
        disabled={tipAmount <= 0 || isSending}
      >
        <Send size={16} />
        {isSending ? 'Sending...' : `Send $${tipAmount.toFixed(2)} Tip`}
      </button>

      {/* Platform Fee Notice */}
      <div className="fee-notice">
        <span>PLATFORM_FEE_PCT = 0.10</span>
        <span className="immutable-badge">IMMUTABLE</span>
      </div>
    </div>
  );
};

export default TipsTab;
