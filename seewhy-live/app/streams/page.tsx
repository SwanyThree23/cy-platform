import { createClient } from '@/lib/supabase/server'
import { StreamCard } from '@/components/stream/StreamCard'
import type { Stream } from '@/types'

export const revalidate = 15

const CATEGORIES = ['All', 'Music', 'Gaming', 'Talk', 'Sports', 'Education', 'Tech', 'Art', 'Fitness']

async function getStreams(category?: string): Promise<Stream[]> {
  const supabase = await createClient()
  let query = supabase
    .from('streams')
    .select('*, host:profiles(*)')
    .in('status', ['live', 'scheduled'])
    .order('status', { ascending: false })
    .order('viewer_count', { ascending: false })

  if (category && category !== 'All') {
    query = query.eq('category', category.toUpperCase())
  }

  const { data } = await query.limit(48)
  return (data as Stream[]) ?? []
}

export default async function StreamsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const streams = await getStreams(category)
  const liveCount = streams.filter(s => s.status === 'live').length

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-white">Browse Streams</h1>
          <p className="text-gray-400 text-sm mt-1">{liveCount} live · {streams.length} total</p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap mb-8">
        {CATEGORIES.map(cat => (
          <a
            key={cat}
            href={cat === 'All' ? '/streams' : `/streams?category=${cat}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              (category === cat || (!category && cat === 'All'))
                ? 'text-black font-bold'
                : 'text-gray-300 bg-white/5 hover:bg-white/10'
            }`}
            style={
              (category === cat || (!category && cat === 'All'))
                ? { background: 'linear-gradient(135deg, #FFD700, #FFA500)' }
                : {}
            }
          >
            {cat}
          </a>
        ))}
      </div>

      {streams.length === 0 ? (
        <div className="text-center py-24 text-gray-500">
          <p className="text-2xl mb-2">Nothing live in {category ?? 'this category'}</p>
          <p className="text-sm">Check back soon or start your own stream</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {streams.map(stream => (
            <StreamCard key={stream.id} stream={stream} />
          ))}
        </div>
      )}
    </div>
  )
}
