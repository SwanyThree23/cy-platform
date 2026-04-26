'use client'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mic, MicOff, Video, VideoOff, Crown } from 'lucide-react'
import type { GuestSlot, Profile } from '@/types'

interface Props {
  streamId: string
  host: Profile
}

export function GoldBoard({ streamId, host }: Props) {
  const [guests, setGuests] = useState<GuestSlot[]>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('stream_guests')
      .select('*')
      .eq('stream_id', streamId)
      .order('position')
      .then(({ data }) => setGuests((data as GuestSlot[]) ?? []))

    const channel = supabase
      .channel(`guests:${streamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_guests', filter: `stream_id=eq.${streamId}` },
        () => {
          supabase.from('stream_guests').select('*').eq('stream_id', streamId).order('position')
            .then(({ data }) => setGuests((data as GuestSlot[]) ?? []))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [streamId, supabase])

  const occupiedGuests = guests.filter(g => g.user_id)

  if (occupiedGuests.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 mb-3">Gold Board</h3>
      <div className="flex flex-col gap-3">
        {/* Host Panel — pinned top-left with gold border */}
        <HostPanel host={host} />

        {/* Guest Grid — scrollable rows */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-80 overflow-y-auto">
          {occupiedGuests.map(guest => (
            <GuestPanel key={guest.position} guest={guest} />
          ))}
        </div>
      </div>
    </div>
  )
}

function HostPanel({ host }: { host: Profile }) {
  return (
    <div className="gold-border rounded-xl p-3 flex items-center gap-3 bg-brand-card" style={{ maxWidth: 300 }}>
      <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
        {host.avatar_url ? (
          <Image src={host.avatar_url} alt={host.display_name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-black text-lg">
            {host.display_name[0]}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Crown size={13} className="text-yellow-400" />
          <span className="text-yellow-400 text-xs font-bold uppercase tracking-wide">Host</span>
        </div>
        <p className="text-white font-semibold truncate">{host.display_name}</p>
      </div>
    </div>
  )
}

function GuestPanel({ guest }: { guest: GuestSlot }) {
  return (
    <div className="rounded-lg p-2.5 bg-brand-card border border-brand-border flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center text-sm font-bold text-white">
        {guest.username?.[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-white text-xs font-medium truncate">{guest.username ?? 'Guest'}</p>
        <p className="text-gray-500 text-xs">{guest.role}</p>
      </div>
      <div className="flex flex-col gap-0.5">
        {guest.is_muted
          ? <MicOff size={11} className="text-red-400" />
          : <Mic size={11} className="text-green-400" />}
        {guest.is_camera_off
          ? <VideoOff size={11} className="text-red-400" />
          : <Video size={11} className="text-green-400" />}
      </div>
    </div>
  )
}
