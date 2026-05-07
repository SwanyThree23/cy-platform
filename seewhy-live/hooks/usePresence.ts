'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface PresenceUser {
  userId:      string
  username:    string
  avatar_url:  string | null
  joinedAt:    number
  isHost:      boolean
}

export function useStreamPresence(streamId: string, currentUserId: string | null, username?: string) {
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([])
  const [viewerCount,  setViewerCount]  = useState(0)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!streamId) return

    const channel = supabase.channel(`presence:${streamId}`, {
      config: { presence: { key: currentUserId ?? `anon_${Math.random().toString(36).slice(2, 8)}` } },
    })

    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        const users = Object.values(state).flat()
        setPresentUsers(users)
        setViewerCount(users.length)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setPresentUsers(prev => {
          const ids   = new Set(prev.map(u => u.userId))
          const fresh = (newPresences as unknown as PresenceUser[]).filter(u => !ids.has(u.userId))
          return [...prev, ...fresh]
        })
        setViewerCount(c => c + newPresences.length)
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const leftIds = new Set((leftPresences as unknown as PresenceUser[]).map(u => u.userId))
        setPresentUsers(prev => prev.filter(u => !leftIds.has(u.userId)))
        setViewerCount(c => Math.max(0, c - leftPresences.length))
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED' && currentUserId) {
          await channel.track({
            userId:     currentUserId,
            username:   username ?? 'Viewer',
            avatar_url: null,
            joinedAt:   Date.now(),
            isHost:     false,
          } satisfies PresenceUser)
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [streamId, currentUserId, username])

  return { presentUsers, viewerCount }
}
