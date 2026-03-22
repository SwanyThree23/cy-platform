import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Clock } from 'lucide-react';

// IMMUTABLE - DO NOT CHANGE
const PLATFORM_FEE_PCT = 0.10;
const PREVIEW_SECONDS = 120;

interface GoldenPaywallProps {
  priceCents: number;
  creatorName: string;
  streamTitle: string;
  onUnlock: () => void;
  isUnlocked: boolean;
}

export const GoldenPaywall: React.FC<GoldenPaywallProps> = ({
  priceCents,
  creatorName,
  streamTitle,
  onUnlock,
  isUnlocked
}) => {
  const [previewTimeLeft, setPreviewTimeLeft] = useState(PREVIEW_SECONDS);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate 90/10 split
  const platformCents = Math.floor(priceCents * PLATFORM_FEE_PCT);
  const creatorCents = priceCents - platformCents;

  // Preview countdown timer
  useEffect(() => {
    if (isUnlocked || priceCents === 0) return;

    const timer = setInterval(() => {
      setPreviewTimeLeft(prev => {
        if (prev <= 1) {
          setShowPaywall(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isUnlocked, priceCents]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUnlock = async () => {
    setIsProcessing(true);
    try {
      // In production, this would call Stripe checkout
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      onUnlock();
    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Don't show paywall if unlocked or free stream
  if (isUnlocked || priceCents === 0) {
    return null;
  }

  // Show preview timer before paywall kicks in
  if (!showPaywall && previewTimeLeft > 0) {
    return (
      <div className="preview-timer">
        <Clock size={14} />
        <span>Free preview: {formatTime(previewTimeLeft)}</span>
      </div>
    );
  }

  return (
    <div className="paywall-overlay">
      <div className="paywall-content">
        <Lock className="paywall-lock" />
        
        <h2 className="paywall-title">PREMIUM CONTENT</h2>
        <p className="paywall-subtitle">{streamTitle}</p>
        <p className="paywall-creator">by {creatorName}</p>

        <button 
          className="paywall-unlock-btn"
          onClick={handleUnlock}
          disabled={isProcessing}
        >
          <Unlock size={16} />
          {isProcessing ? 'Processing...' : `UNLOCK - $${(priceCents / 100).toFixed(2)}`}
        </button>

        <div className="paywall-split-info">
          <span>Creator keeps 90% - ${(creatorCents / 100).toFixed(2)}</span>
          <span className="separator">|</span>
          <span>Platform: ${(platformCents / 100).toFixed(2)}</span>
        </div>

        <div className="paywall-badge">
          <code>PLATFORM_FEE_PCT = 0.10</code>
        </div>
      </div>
    </div>
  );
};

// Preview Timer Badge Component
export const PreviewTimerBadge: React.FC<{ 
  previewSeconds?: number;
  onExpire?: () => void;
}> = ({ 
  previewSeconds = PREVIEW_SECONDS,
  onExpire 
}) => {
  const [timeLeft, setTimeLeft] = useState(previewSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [previewSeconds, onExpire]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (timeLeft / previewSeconds) * 100;
  const isLow = timeLeft < 30;

  return (
    <div className={`preview-badge ${isLow ? 'warning' : ''}`}>
      <div className="preview-progress" style={{ width: `${progress}%` }}></div>
      <Clock size={12} />
      <span>Preview: {formatTime(timeLeft)}</span>
    </div>
  );
};

export default GoldenPaywall;
