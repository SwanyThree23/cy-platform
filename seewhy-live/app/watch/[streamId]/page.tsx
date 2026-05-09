import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { StreamView } from '@/components/stream/StreamView'
import type { Stream } from '@/types'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://seewhylive.online'

interface Props {
  params: Promise<{ streamId: string }>
}

async function getStream(streamId: string): Promise<Stream | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('streams')
    .select('*, host:profiles(*)')
    .eq('id', streamId)
    .single()
  return data as Stream | null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { streamId } = await params
  const stream = await getStream(streamId)

  const title       = stream?.title || 'Live Stream'
  const creator     = stream?.host?.display_name || 'Creator'
  const isLive      = stream?.status === 'live'
  const description = `${creator} is ${isLive ? 'live' : 'streaming'} on SeeWhy LIVE — ${title}`
  const ogImage     = `${BASE_URL}/api/og/stream?streamId=${streamId}`

  return {
    title:       `${title} — SeeWhy LIVE`,
    description,
    openGraph: {
      title,
      description,
      url:       `${BASE_URL}/watch/${streamId}`,
      siteName:  'SeeWhy LIVE',
      type:      'video.other',
      images: [
        {
          url:    ogImage,
          width:  1200,
          height: 630,
          alt:    title,
        },
      ],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      [ogImage],
    },
  }
}

export default async function WatchPage({ params }: Props) {
  const { streamId } = await params
  const stream = await getStream(streamId)
  if (!stream) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <StreamView stream={stream} currentUserId={user?.id ?? null} />
}
