'use client'

import { useState } from 'react'
import { Share2, Copy, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

interface ChatterSocialShareProps {
  streamId:    string
  title:       string
  creatorName: string
  handle:      string
  watchUrl:    string
  viewerCount: number
  isLive:      boolean
  tipEnabled:  boolean
}

export default function ChatterSocialShare({
  streamId, title, creatorName, handle, watchUrl, viewerCount, isLive, tipEnabled,
}: ChatterSocialShareProps) {
  const [open, setOpen]       = useState(false)
  const [copied, setCopied]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [card, setCard]       = useState<{
    announcementText: string
    clipboardText:    string
    chatterDeepLink:  string
  } | null>(null)

  async function loadCard() {
    if (card) { setOpen(o => !o); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/share/chattersocial/${streamId}`)
      if (res.ok) setCard(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
    setOpen(true)
  }

  async function copyToClipboard() {
    const text = card?.clipboardText || buildFallbackText()
    await navigator.clipboard.writeText(text).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function buildFallbackText() {
    const status  = isLive ? '🔴 LIVE NOW' : '🎬 Starting Soon'
    const viewers = isLive && viewerCount > 0 ? `\n👥 ${viewerCount} watching` : ''
    const tips    = tipEnabled ? '\n💸 Direct tips — 0% platform cut' : ''
    return `${status} — ${title}\n\n🎙️ ${creatorName} (@${handle})${viewers}${tips}\n\n▶️ ${watchUrl}\n\n#SeeWhyLive #DominoEntertainment`
  }

  return (
    <div className="relative">
      <button
        onClick={loadCard}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-gold/20 border border-gold/40 rounded-lg text-gold text-sm font-medium hover:bg-gold/30 transition-colors disabled:opacity-50"
      >
        <Share2 size={15} />
        {loading ? 'Loading…' : 'Share'}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass rounded-xl border border-gold/25 shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-gold/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 size={15} className="text-gold" />
              <span className="text-gold font-semibold text-sm">Share on ChatterSocial</span>
            </div>
            {isLive && (
              <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" /> LIVE
              </span>
            )}
          </div>

          <div className="p-4 space-y-3">
            <textarea
              readOnly
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 resize-none focus:outline-none font-mono leading-relaxed"
              rows={6}
              value={card?.clipboardText || buildFallbackText()}
            />

            <div className="flex gap-2">
              <button
                onClick={copyToClipboard}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gold text-black font-bold rounded-lg text-sm hover:bg-gold/90 transition-colors"
              >
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Post</>}
              </button>

              {card?.chatterDeepLink && (
                <a
                  href={card.chatterDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm hover:bg-white/15 transition-colors"
                >
                  <ExternalLink size={14} /> Open
                </a>
              )}
            </div>

            <p className="text-xs text-gray-600">
              Paste into your ChatterSocial post composer to announce the stream.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
