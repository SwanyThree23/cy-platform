import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StreamCard } from '@/components/stream/StreamCard'
import type { Stream } from '@/types'

export const revalidate = 30

async function getLiveStreams(): Promise<Stream[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('streams')
    .select('*, host:profiles(*)')
    .eq('status', 'live')
    .order('viewer_count', { ascending: false })
    .limit(12)
  return (data as Stream[]) ?? []
}

export default async function HomePage() {
  const streams = await getLiveStreams()

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero */}
      <section className="text-center py-16 mb-12">
        <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1.5 text-sm text-yellow-400 mb-6">
          <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          {streams.length} streams live now
        </div>
        <h1 className="text-5xl md:text-7xl font-black mb-4" style={{ color: 'var(--gold)' }}>
          SeeWhy Live
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
          Gold-board panels. Zero platform fees. Stream with up to 20 guests across every platform simultaneously.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-8 py-3 rounded-lg font-bold text-black text-lg transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
          >
            Go Live
          </Link>
          <Link
            href="/streams"
            className="px-8 py-3 rounded-lg font-bold text-white border border-white/20 hover:border-yellow-500/50 transition-all"
          >
            Browse Streams
          </Link>
        </div>
      </section>

      {/* Live Streams Grid */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            <span className="live-badge mr-3">LIVE</span>
            Right Now
          </h2>
          <Link href="/streams" className="text-yellow-400 hover:text-yellow-300 text-sm">
            See all →
          </Link>
        </div>

        {streams.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-xl mb-2">No streams live right now</p>
            <p className="text-sm">Be the first to go live today</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {streams.map(stream => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        )}
      </section>

      {/* Feature Highlights */}
      <section className="mt-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: '🥇', title: 'Gold Board Grid', desc: 'Host pinned top-left with neon gold border. Up to 20 guest panels in a scrollable grid.' },
          { icon: '💸', title: '0% Platform Cut', desc: 'Tips and donations go directly to creators via PayPal, Cash App, Venmo, or Zelle.' },
          { icon: '📡', title: 'Multi-Platform Fan-out', desc: 'Simultaneously stream to Instagram, TikTok, YouTube, and Facebook from one dashboard.' },
        ].map(f => (
          <div key={f.title} className="rounded-2xl p-6 glass">
            <div className="text-4xl mb-3">{f.icon}</div>
            <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
