import Link from 'next/link'
import Image from 'next/image'
import { Eye, Clock } from 'lucide-react'
import { formatViewers } from '@/lib/utils'
import type { Stream } from '@/types'

export function StreamCard({ stream }: { stream: Stream }) {
  const isLive = stream.status === 'live'

  return (
    <Link href={`/streams/${stream.id}`} className="group block">
      <div className="rounded-xl overflow-hidden bg-brand-card border border-brand-border hover:border-yellow-500/40 transition-all hover:scale-[1.02]">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-gray-900">
          {stream.thumbnail_url ? (
            <Image src={stream.thumbnail_url} alt={stream.title} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/20 to-gray-900 flex items-center justify-center">
              <span className="text-4xl">📡</span>
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            {isLive ? (
              <span className="live-badge">LIVE</span>
            ) : (
              <span className="flex items-center gap-1 bg-gray-800/90 text-gray-300 text-xs font-medium px-2 py-0.5 rounded">
                <Clock size={10} /> SCHEDULED
              </span>
            )}
          </div>

          {isLive && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded px-2 py-0.5 text-xs text-white">
              <Eye size={10} />
              {formatViewers(stream.viewer_count)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 flex gap-3">
          <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex-shrink-0 overflow-hidden">
            {stream.host.avatar_url ? (
              <Image src={stream.host.avatar_url} alt={stream.host.display_name} width={32} height={32} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-yellow-400 font-bold">
                {stream.host.display_name[0]}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{stream.title}</p>
            <p className="text-gray-400 text-xs truncate">{stream.host.display_name}</p>
            <p className="text-gray-500 text-xs mt-0.5">{stream.category}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}
