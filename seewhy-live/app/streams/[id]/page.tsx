import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StreamView } from '@/components/stream/StreamView'
import type { Stream } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

async function getStream(id: string): Promise<Stream | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('streams')
    .select('*, host:profiles(*)')
    .eq('id', id)
    .single()
  return data as Stream | null
}

export default async function StreamPage({ params }: Props) {
  const { id } = await params
  const stream = await getStream(id)
  if (!stream) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <StreamView stream={stream} currentUserId={user?.id ?? null} />
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const stream = await getStream(id)
  if (!stream) return {}
  return {
    title: `${stream.title} — SeeWhy Live`,
    description: `Watch ${stream.host.display_name} live on SeeWhy Live`,
    openGraph: {
      images: stream.thumbnail_url ? [stream.thumbnail_url] : [],
    },
  }
}
