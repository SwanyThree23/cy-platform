'use client'
import { useEffect, useState } from 'react'
import { StreamPlayer } from './StreamPlayer'
import { StreamChat } from './StreamChat'
import { GoldBoard } from './GoldBoard'
import { Eye, Share2, Heart } from 'lucide-react'
import { formatViewers } from '@/lib/utils'
import type { Stream } from '@/types'

interface Props {
  stream: Stream
  currentUserId: string | null
}

export function StreamView({ stream, currentUserId }: Props) {
  const [livekitToken, setLivekitToken] = useState<string | null>(null)
  const [viewerCount, setViewerCount]   = useState(stream.viewer_count)

  useEffect(() => {
    if (stream.status !== 'live') return
    fetch(`/api/livekit?room=${stream.livekit_room}&identity=${currentUserId ?? 'anon-' + Math.random().toString(36).slice(2)}`)
      .then(r => r.json())
      .then(d => setLivekitToken(d.token))
  }, [stream.livekit_room, stream.status, currentUserId])

  async function copyShareLink() {
    await navigator.clipboard.writeText(window.location.href)
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-2 sm:px-4 py-4">
      <div className="flex flex-col xl:flex-row gap-4">
        {/* Left: Video + Info */}
        <div className="flex-1 min-w-0">
          {/* Video Player */}
          <div className="rounded-xl overflow-hidden bg-black aspect-video">
            {stream.status === 'live' && livekitToken ? (
              <StreamPlayer token={livekitToken} serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 flex-col gap-3">
                <span className="text-5xl">📺</span>
                <p>{stream.status === 'scheduled' ? 'Stream hasn\'t started yet' : 'Stream has ended'}</p>
              </div>
            )}
          </div>

          {/* Stream Info */}
          <div className="mt-4 px-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-white">{stream.title}</h1>
                <p className="text-gray-400 text-sm mt-1">
                  {stream.host.display_name}
                  {stream.status === 'live' && (
                    <span className="ml-3 inline-flex items-center gap-1 text-gray-400">
                      <Eye size={13} /> {formatViewers(viewerCount)} watching
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={copyShareLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition-colors"
                >
                  <Share2 size={14} /> Share
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-sm text-red-400 transition-colors border border-red-500/20">
                  <Heart size={14} /> Follow
                </button>
              </div>
            </div>

            {stream.description && (
              <p className="text-gray-400 text-sm mt-4 leading-relaxed">{stream.description}</p>
            )}

            {/* Tip buttons */}
            <div className="mt-4 flex gap-2 flex-wrap">
              {[
                { label: 'Tip $1', amount: 100 },
                { label: 'Tip $5', amount: 500 },
                { label: 'Tip $10', amount: 1000 },
              ].map(({ label, amount }) => (
                <button
                  key={label}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/10 transition-colors"
                >
                  💰 {label}
                </button>
              ))}
            </div>
          </div>

          {/* Gold Board (guest grid) */}
          <div className="mt-6">
            <GoldBoard streamId={stream.id} host={stream.host} />
          </div>
        </div>

        {/* Right: Chat */}
        <div className="w-full xl:w-80 xl:flex-shrink-0">
          <StreamChat streamId={stream.id} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  )
}
