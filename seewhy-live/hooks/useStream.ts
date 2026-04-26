'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Stream } from '@/types'

export function useStream(streamId: string) {
  const [stream, setStream] = useState<Stream | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchStream = useCallback(async () => {
    const { data } = await supabase
      .from('streams')
      .select('*, host:profiles(*)')
      .eq('id', streamId)
      .single()
    if (data) setStream(data as Stream)
    setLoading(false)
  }, [streamId, supabase])

  useEffect(() => {
    fetchStream()

    const channel = supabase
      .channel(`stream:${streamId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'streams', filter: `id=eq.${streamId}` },
        (payload) => setStream(prev => prev ? { ...prev, ...payload.new } : null)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [streamId, fetchStream, supabase])

  return { stream, loading }
}

export function useLiveStreams() {
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('streams')
      .select('*, host:profiles(*)')
      .eq('status', 'live')
      .order('viewer_count', { ascending: false })
      .then(({ data }) => {
        if (data) setStreams(data as Stream[])
        setLoading(false)
      })

    const channel = supabase
      .channel('live-streams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' },
        () => { /* refetch on any stream change */ }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  return { streams, loading }
}
