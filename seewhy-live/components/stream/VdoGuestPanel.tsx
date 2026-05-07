'use client'

import { useState } from 'react'
import { ExternalLink, Camera, Plus, X, Link2 } from 'lucide-react'

interface VdoGuestPanelProps {
  position:  number
  username?: string
  onRemove?: () => void
}

// VDO.Ninja invite URL builder — generates a guest room link
// See https://vdo.ninja/?room=ROOMID&label=NAME
const VDO_BASE = 'https://vdo.ninja'

function buildViewUrl(roomId: string, label?: string): string {
  const params = new URLSearchParams({
    view:  roomId,
    scene: '1',
    ...(label ? { label } : {}),
  })
  return `${VDO_BASE}/?${params}`
}

function buildGuestUrl(roomId: string, label?: string): string {
  const params = new URLSearchParams({
    room:  roomId,
    push:  '1',
    ...(label ? { label } : {}),
  })
  return `${VDO_BASE}/?${params}`
}

export function VdoGuestPanel({ position, username, onRemove }: VdoGuestPanelProps) {
  const [roomId, setRoomId]     = useState('')
  const [connected, setConnected] = useState(false)
  const [inputUrl, setInputUrl] = useState('')

  // Derive room from pasted VDO.Ninja guest URL or direct room ID
  function connect() {
    let rid = inputUrl.trim()
    try {
      const url = new URL(rid)
      rid = url.searchParams.get('room') || url.searchParams.get('view') || rid
    } catch { /* plain room ID */ }
    if (rid) {
      setRoomId(rid)
      setConnected(true)
    }
  }

  const viewUrl  = roomId ? buildViewUrl(roomId, username) : ''

  return (
    <div className="relative h-full w-full bg-black/60 rounded-xl overflow-hidden border border-white/10">
      {connected && roomId ? (
        <>
          <iframe
            src={viewUrl}
            allow="camera; microphone; display-capture; autoplay"
            className="w-full h-full border-0"
            title={`Guest ${position} — VDO.Ninja`}
          />
          {/* Controls overlay */}
          <div className="absolute top-2 right-2 flex gap-1">
            <a
              href={buildGuestUrl(roomId)}
              target="_blank"
              rel="noopener noreferrer"
              title="Open guest link"
              className="p-1.5 bg-black/70 rounded-lg text-gray-300 hover:text-white"
            >
              <ExternalLink size={13} />
            </a>
            <button
              onClick={() => { setConnected(false); setRoomId(''); onRemove?.() }}
              className="p-1.5 bg-black/70 rounded-lg text-gray-300 hover:text-red-400"
            >
              <X size={13} />
            </button>
          </div>
          <div className="absolute bottom-2 left-2 text-xs text-gray-400 bg-black/60 px-2 py-0.5 rounded">
            Slot {position} · VDO.Ninja
          </div>
        </>
      ) : (
        <div className="h-full flex flex-col items-center justify-center gap-3 p-4">
          <Camera size={28} className="text-gray-600" />
          <p className="text-gray-500 text-xs text-center">Guest Slot {position}</p>
          <div className="w-full space-y-2">
            <input
              className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-gold/40"
              placeholder="VDO.Ninja room ID or invite link…"
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && connect()}
            />
            <button
              onClick={connect}
              disabled={!inputUrl.trim()}
              className="w-full py-1.5 text-xs bg-gold/20 border border-gold/30 rounded-lg text-gold hover:bg-gold/30 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
            >
              <Link2 size={12} /> Connect Guest
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Panel manager used by LiveRoom / host view ──

interface VdoGuestManagerProps {
  streamId: string
  maxGuests?: number
}

export function VdoGuestManager({ streamId, maxGuests = 9 }: VdoGuestManagerProps) {
  const [panels, setPanels] = useState<number[]>([1])

  function addPanel() {
    if (panels.length >= maxGuests) return
    const next = Math.max(...panels) + 1
    setPanels(p => [...p, next])
  }

  function removePanel(pos: number) {
    setPanels(p => p.filter(n => n !== pos))
  }

  // Generate a sharable guest invite link for this stream's VDO room
  const roomId   = streamId.replace(/-/g, '').slice(0, 12)
  const guestInvite = buildGuestUrl(roomId, 'Guest')

  return (
    <div className="space-y-4">
      {/* Invite link */}
      <div className="glass rounded-xl border border-gold/20 p-4">
        <p className="text-xs text-gray-400 mb-2">Guest invite link — share with co-streamers:</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={guestInvite}
            className="flex-1 text-xs px-3 py-2 bg-black/30 border border-gold/20 rounded-lg text-gold font-mono focus:outline-none"
          />
          <a
            href={guestInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-gold/15 border border-gold/25 rounded-lg text-gold hover:bg-gold/25 transition-colors"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Guest panels grid */}
      <div className="grid grid-cols-3 gap-2" style={{ gridAutoRows: '140px' }}>
        {panels.map(pos => (
          <VdoGuestPanel
            key={pos}
            position={pos}
            onRemove={() => removePanel(pos)}
          />
        ))}
        {panels.length < maxGuests && (
          <button
            onClick={addPanel}
            className="h-full min-h-[140px] border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-600 hover:border-gold/30 hover:text-gold transition-colors"
          >
            <Plus size={20} />
            <span className="text-xs">Add Guest</span>
          </button>
        )}
      </div>
    </div>
  )
}
