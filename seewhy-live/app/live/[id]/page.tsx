import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LiveRoom } from '@/components/stream/LiveRoom'
import type { Stream } from '@/types'

async function getStream(id: string): Promise<Stream | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('streams')
    .select('*, host:profiles(*)')
    .eq('id', id)
    .single()
  return data as Stream | null
}

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const stream = await getStream(id)
  if (!stream) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <LiveRoom stream={stream} currentUserId={user?.id ?? null} />
}
