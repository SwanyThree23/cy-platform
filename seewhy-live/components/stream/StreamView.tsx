'use client'
import { useEffect, useState } from 'react'
import { StreamPlayer } from './StreamPlayer'
import { StreamChat } from './StreamChat'
import { GoldBoard } from './GoldBoard'
import { TipSheet } from './TipSheet'
import { SocialShare } from './SocialShare'
import { PollOverlay } from './PollOverlay'
import ChatterSocialShare from '@/components/share/ChatterSocialShare'
import { Eye, Share2, Heart, DollarSign, BarChart2 } from 'lucide-react'
import { formatViewers } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Stream } from '@/types'

interface Props {
  stream: Stream
  currentUserId: string | null
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://seewhylive.online'

export function StreamView({ stream, currentUserId }: Props) {
  const [livekitToken, setLivekitToken] = useState<string | null>(null)
  const [viewerCount, setViewerCount]   = useState(stream.viewer_count)
  const [showTip, setShowTip]           = useState(false)
  const [showShare, setShowShare]       = useState(false)
  const [followed, setFollowed]         = useState(false)

  const isHost = !!currentUserId && currentUserId === stream.host_id
  const watchUrl = `${BASE_URL}/watch/${stream.id}`

  const supabase = createClient()

  useEffect(() => {
    if (stream.status !== 'live') return
    fetch(`/api/livekit?room=${stream.livekit_room}&identity=${currentUserId ?? 'anon-' + Math.random().toString(36).slice(2)}`)
      .then(r => r.json())
      .then(d => setLivekitToken(d.token))
  }, [stream.livekit_room, stream.status, currentUserId])

  // Live viewer count via Supabase realtime
  useEffect(() => {
    if (stream.status !== 'live') return
    const channel = supabase
      .channel(`viewers:${stream.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table:  'streams',
        filter: `id=eq.${stream.id}`,
      }, payload => {
        if (payload.new?.viewer_count !== undefined) {
          setViewerCount(payload.new.viewer_count as number)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [stream.id, stream.status])

  async function handleFollow() {
    if (!currentUserId) return
    await supabase.from('follows').upsert({ follower_id: currentUserId, followed_id: stream.host_id })
    setFollowed(true)
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-2 sm:px-4 py-4 relative">
      {/* Poll overlay — visible to all, host can create */}
      <PollOverlay
        streamId={stream.id}
        hostId={stream.host_id}
        currentUserId={currentUserId}
      />

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
                <p>{stream.status === 'scheduled' ? "Stream hasn't started yet" : 'Stream has ended'}</p>
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

              {/* Action bar */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Tip button */}
                <button
                  onClick={() => setShowTip(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/15 hover:bg-gold/25 text-gold text-sm font-semibold border border-gold/30 transition-colors"
                >
                  <DollarSign size={14} /> Tip
                </button>

                {/* Share — ChatterSocial-aware for host, plain clipboard for viewers */}
                {isHost ? (
                  <ChatterSocialShare
                    streamId={stream.id}
                    title={stream.title}
                    creatorName={stream.host.display_name}
                    handle={stream.host.username}
                    watchUrl={watchUrl}
                    viewerCount={viewerCount}
                    isLive={stream.status === 'live'}
                    tipEnabled={true}
                  />
                ) : (
                  <button
                    onClick={() => setShowShare(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 transition-colors"
                  >
                    <Share2 size={14} /> Share
                  </button>
                )}

                {/* Poll button (host only) */}
                {isHost && (
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 text-sm border border-purple-500/25 transition-colors"
                    title="Launch poll"
                    onClick={() => {
                      // Scroll down to PollOverlay create button
                      const el = document.querySelector('[data-poll-create]') as HTMLElement
                      el?.click()
                    }}
                  >
                    <BarChart2 size={14} /> Poll
                  </button>
                )}

                {/* Follow */}
                {!isHost && (
                  <button
                    onClick={handleFollow}
                    disabled={followed}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                      followed
                        ? 'bg-red-500/20 text-red-300 border-red-500/30 cursor-default'
                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                    }`}
                  >
                    <Heart size={14} fill={followed ? 'currentColor' : 'none'} />
                    {followed ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            </div>

            {stream.description && (
              <p className="text-gray-400 text-sm mt-4 leading-relaxed">{stream.description}</p>
            )}
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

      {/* TipSheet modal */}
      {showTip && (
        <TipSheet host={stream.host} onClose={() => setShowTip(false)} />
      )}

      {/* SocialShare modal */}
      {showShare && (
        <SocialShare stream={stream} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}
