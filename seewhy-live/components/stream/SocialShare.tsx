'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Copy, Check, ExternalLink } from 'lucide-react'
import type { Stream } from '@/types'

interface Props {
  stream: Stream
  onClose: () => void
}

const PLATFORMS = [
  {
    id: 'instagram',
    label: 'Instagram Story',
    emoji: '📸',
    color: '#e1306c',
    shareUrl: (url: string, title: string) =>
      `https://www.instagram.com/share?url=${encodeURIComponent(url)}`,
    tip: 'Tap to open Instagram, then share the link in your Story',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    emoji: '🎵',
    color: '#010101',
    shareUrl: (url: string, title: string) =>
      `https://www.tiktok.com/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
    tip: 'Share to your TikTok bio or DM the link',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    emoji: '👍',
    color: '#1877f2',
    shareUrl: (url: string, title: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`,
    tip: 'Posts directly to your Facebook timeline',
  },
  {
    id: 'snapchat',
    label: 'Snapchat',
    emoji: '👻',
    color: '#fffc00',
    shareUrl: (url: string) =>
      `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(url)}`,
    tip: 'Share as a Snap with the stream link',
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    emoji: '🐦',
    color: '#000000',
    shareUrl: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`🔴 Watching ${title} live on SeeWhy! Join me →`)}`,
    tip: 'Posts a tweet with the stream link',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    emoji: '💬',
    color: '#25d366',
    shareUrl: (url: string, title: string) =>
      `https://wa.me/?text=${encodeURIComponent(`🔴 Watch ${title} live on SeeWhy! ${url}`)}`,
    tip: 'Send directly to your WhatsApp contacts',
  },
]

export function SocialShare({ stream, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const streamUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://seewhylive.online'}/streams/${stream.id}`
  const embedUrl  = `${streamUrl}?embed=1`

  async function copyLink() {
    await navigator.clipboard.writeText(streamUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function share(platform: typeof PLATFORMS[0]) {
    const url = platform.shareUrl(streamUrl, stream.title)
    window.open(url, '_blank', 'width=600,height=500')
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm mx-4 rounded-3xl bg-brand-card border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-white font-bold text-lg">Share Stream</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-3">
          {/* Copy link */}
          <div className="flex gap-2">
            <input readOnly value={streamUrl} className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono" />
            <button
              onClick={copyLink}
              className="px-4 py-2.5 rounded-xl text-black font-bold text-sm flex items-center gap-1.5 transition-all"
              style={{ background: copied ? '#00c853' : 'linear-gradient(135deg,#FFD700,#FFA500)' }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <p className="text-gray-500 text-xs text-center">Viewers can watch without downloading the app</p>

          {/* Platform grid */}
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => share(p)}
                className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 hover:border-white/20 transition-all active:scale-95 text-left"
                style={{ background: `${p.color}15` }}
              >
                <span className="text-2xl">{p.emoji}</span>
                <span className="text-white text-sm font-medium">{p.label}</span>
              </button>
            ))}
          </div>

          {/* Embed */}
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Embed on your website</p>
            <code className="text-xs text-green-400 break-all">
              {`<iframe src="${embedUrl}" allow="camera;microphone;autoplay" />`}
            </code>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
