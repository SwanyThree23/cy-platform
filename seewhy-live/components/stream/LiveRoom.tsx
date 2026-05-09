'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, Video, VideoOff, Crown, Users, Lock, Headphones,
  Maximize2, Minimize2, Share2, DollarSign, BarChart2, Eye, X
} from 'lucide-react'
import { GoldBoard } from './GoldBoard'
import { StreamChat } from './StreamChat'
import { TipSheet } from './TipSheet'
import { SocialShare } from './SocialShare'
import { PollOverlay } from './PollOverlay'
import { formatViewers } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Stream, GuestSlot } from '@/types'

interface Props {
  stream: Stream
  currentUserId: string | null
}

type RoomMode = 'camera' | 'audio' | 'private'

export function LiveRoom({ stream, currentUserId }: Props) {
  const [guests, setGuests]         = useState<GuestSlot[]>([])
  const [expandedGuest, setExpanded] = useState<number | null>(null)
  const [showTip, setShowTip]       = useState(false)
  const [showShare, setShowShare]   = useState(false)
  const [showPoll, setShowPoll]     = useState(false)
  const [mode, setMode]             = useState<RoomMode>('camera')
  const [viewerCount, setViewerCount] = useState(stream.viewer_count)
  const isHost = currentUserId === stream.host_id
  const supabase = createClient()

  useEffect(() => {
    supabase.from('stream_guests').select('*').eq('stream_id', stream.id).order('position')
      .then(({ data }) => setGuests((data as GuestSlot[]) ?? []))

    const ch = supabase.channel(`live:${stream.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_guests', filter: `stream_id=eq.${stream.id}` },
        () => supabase.from('stream_guests').select('*').eq('stream_id', stream.id).order('position')
          .then(({ data }) => setGuests((data as GuestSlot[]) ?? []))
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${stream.id}` },
        (p) => setViewerCount((p.new as Stream).viewer_count)
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [stream.id, supabase])

  const occupiedGuests = guests.filter(g => g.user_id)
  const maxGuests = 20

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 glass">
        <div className="flex items-center gap-3">
          <span className="live-badge">LIVE</span>
          {mode === 'audio' && (
            <span className="flex items-center gap-1 bg-blue-500/20 text-blue-400 text-xs font-medium px-2 py-0.5 rounded">
              <Headphones size={11} /> AUDIO
            </span>
          )}
          {mode === 'private' && (
            <span className="flex items-center gap-1 bg-purple-500/20 text-purple-400 text-xs font-medium px-2 py-0.5 rounded">
              <Lock size={11} /> PRIVATE
            </span>
          )}
          <h1 className="text-white font-semibold text-sm truncate max-w-xs">{stream.title}</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span className="flex items-center gap-1"><Eye size={13} />{formatViewers(viewerCount)}</span>
          <span className="flex items-center gap-1"><Users size={13} />{occupiedGuests.length}/{maxGuests}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Host panel */}
          <div className="relative p-2">
            <div className="gold-border rounded-2xl overflow-hidden bg-black aspect-video max-h-64 md:max-h-80">
              {mode === 'audio' ? (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900/30 to-black">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-3 text-3xl font-black text-yellow-400">
                      {stream.host.display_name[0]}
                    </div>
                    <p className="text-white font-bold">{stream.host.display_name}</p>
                    <div className="flex justify-center gap-1 mt-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-1 bg-blue-400 rounded-full animate-pulse" style={{ height: `${Math.random() * 20 + 8}px`, animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-yellow-900/20 to-black flex items-center justify-center">
                  <span className="text-6xl">📡</span>
                </div>
              )}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-2 py-1">
                <Crown size={12} className="text-yellow-400" />
                <span className="text-yellow-400 text-xs font-bold">{stream.host.display_name}</span>
              </div>
            </div>
          </div>

          {/* Guest Grid — expandable Bigo-style */}
          {occupiedGuests.length > 0 && (
            <div className="px-2 pb-2">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 max-h-72 overflow-y-auto">
                {occupiedGuests.map(guest => (
                  <GuestPanel
                    key={guest.position}
                    guest={guest}
                    isExpanded={expandedGuest === guest.position}
                    onExpand={() => setExpanded(expandedGuest === guest.position ? null : guest.position)}
                    isHost={isHost}
                    audioOnly={mode === 'audio'}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-center gap-3 py-3 px-4 border-t border-white/5">
            <ActionBtn icon={DollarSign} label="Tip" color="gold" onClick={() => setShowTip(true)} />
            <ActionBtn icon={Share2} label="Share" color="blue" onClick={() => setShowShare(true)} />
            {isHost && (
              <>
                <ActionBtn icon={BarChart2} label="Poll" color="purple" onClick={() => setShowPoll(true)} />
                <ModeToggle mode={mode} onChange={setMode} />
              </>
            )}
          </div>
        </div>

        {/* Chat sidebar */}
        <div className="hidden md:flex w-72 border-l border-white/5">
          <StreamChat streamId={stream.id} currentUserId={currentUserId} />
        </div>
      </div>

      {/* Mobile chat */}
      <div className="md:hidden border-t border-white/5" style={{ height: 200 }}>
        <StreamChat streamId={stream.id} currentUserId={currentUserId} />
      </div>

      {/* Poll overlay */}
      <AnimatePresence>
        {showPoll && (
          <PollOverlay streamId={stream.id} hostId={stream.host_id} currentUserId={currentUserId} onClose={() => setShowPoll(false)} />
        )}
      </AnimatePresence>

      {/* Tip sheet */}
      <AnimatePresence>
        {showTip && (
          <TipSheet host={stream.host} onClose={() => setShowTip(false)} />
        )}
      </AnimatePresence>

      {/* Social share */}
      <AnimatePresence>
        {showShare && (
          <SocialShare stream={stream} onClose={() => setShowShare(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function GuestPanel({ guest, isExpanded, onExpand, isHost, audioOnly }: {
  guest: GuestSlot
  isExpanded: boolean
  onExpand: () => void
  isHost: boolean
  audioOnly: boolean
}) {
  return (
    <motion.div
      layout
      className={`relative rounded-xl overflow-hidden bg-brand-card border cursor-pointer transition-all ${
        isExpanded ? 'col-span-2 row-span-2 border-yellow-500/40' : 'border-white/10'
      }`}
      style={{ aspectRatio: '16/9' }}
      onClick={onExpand}
    >
      {audioOnly ? (
        <div className="w-full h-full bg-gradient-to-br from-blue-900/20 to-gray-900 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white">
            {guest.username?.[0]?.toUpperCase() ?? '?'}
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <span className="text-2xl">👤</span>
        </div>
      )}

      {/* Overlay info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
        <p className="text-white text-xs font-medium truncate">{guest.username ?? 'Guest'}</p>
      </div>

      {/* Indicators */}
      <div className="absolute top-1 right-1 flex flex-col gap-0.5">
        {guest.is_muted && <MicOff size={10} className="text-red-400" />}
        {guest.is_camera_off && <VideoOff size={10} className="text-red-400" />}
      </div>

      {/* Expand button */}
      <button className="absolute top-1 left-1 p-0.5 rounded bg-black/40" onClick={onExpand}>
        {isExpanded ? <Minimize2 size={10} className="text-white" /> : <Maximize2 size={10} className="text-white" />}
      </button>
    </motion.div>
  )
}

function ActionBtn({ icon: Icon, label, color, onClick }: { icon: React.ElementType; label: string; color: 'gold' | 'blue' | 'purple'; onClick: () => void }) {
  const colors = { gold: 'text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10', blue: 'text-blue-400 border-blue-500/30 hover:bg-blue-500/10', purple: 'text-purple-400 border-purple-500/30 hover:bg-purple-500/10' }
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl border transition-colors ${colors[color]}`}>
      <Icon size={18} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

function ModeToggle({ mode, onChange }: { mode: RoomMode; onChange: (m: RoomMode) => void }) {
  return (
    <div className="flex gap-1 bg-white/5 rounded-xl p-1">
      {(['camera', 'audio', 'private'] as RoomMode[]).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${mode === m ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
        >
          {m === 'audio' ? '🎙️' : m === 'private' ? '🔒' : '📹'} {m}
        </button>
      ))}
    </div>
  )
}
