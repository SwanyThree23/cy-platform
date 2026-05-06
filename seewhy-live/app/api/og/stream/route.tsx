import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const streamId = req.nextUrl.searchParams.get('streamId')

  let title       = 'SeeWhy LIVE'
  let creatorName = 'Domino Entertainment'
  let isLive      = false
  let viewerCount = 0

  if (streamId) {
    try {
      const supabase = await createClient()
      const { data } = await supabase
        .from('streams')
        .select('title, status, viewer_count, profiles(display_name)')
        .eq('id', streamId)
        .single()

      if (data) {
        title       = data.title || title
        isLive      = data.status === 'live'
        viewerCount = data.viewer_count || 0
        const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
        if (profile?.display_name) creatorName = profile.display_name
      }
    } catch { /* fallback to defaults */ }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width:      '100%',
          height:     '100%',
          display:    'flex',
          flexDirection: 'column',
          background: '#0C0806',
          position:   'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Gold border top */}
        <div style={{ height: 8, background: '#D4AF37', width: '100%' }} />

        {/* Background gradient */}
        <div
          style={{
            position:   'absolute',
            inset:      0,
            background: 'radial-gradient(ellipse at 30% 50%, rgba(212,175,55,0.12) 0%, transparent 60%)',
          }}
        />

        <div
          style={{
            flex:           1,
            display:        'flex',
            flexDirection:  'column',
            justifyContent: 'center',
            padding:        '48px 64px',
            gap:            24,
          }}
        >
          {/* LIVE badge */}
          {isLive && (
            <div
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          10,
                background:   'rgba(220,38,38,0.9)',
                borderRadius: 8,
                padding:      '6px 18px',
                width:        'fit-content',
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'white' }} />
              <span style={{ color: 'white', fontWeight: 900, fontSize: 20, letterSpacing: 3 }}>LIVE</span>
              {viewerCount > 0 && (
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16, marginLeft: 8 }}>
                  {viewerCount >= 1000 ? `${(viewerCount / 1000).toFixed(1)}k` : viewerCount} watching
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <div
            style={{
              fontSize:   isLive ? 68 : 72,
              fontWeight: 900,
              color:      '#F5F5DC',
              lineHeight: 1.1,
              maxWidth:   900,
            }}
          >
            {title}
          </div>

          {/* Creator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width:        4,
                height:       40,
                background:   '#D4AF37',
                borderRadius: 2,
              }}
            />
            <span style={{ color: '#D4AF37', fontSize: 28, fontWeight: 600 }}>
              {creatorName}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '16px 64px',
            borderTop:      '1px solid rgba(212,175,55,0.2)',
          }}
        >
          <span style={{ color: '#D4AF37', fontSize: 22, fontWeight: 800 }}>SeeWhy LIVE</span>
          <span style={{ color: 'rgba(245,245,220,0.5)', fontSize: 16 }}>seewhylive.online</span>
        </div>

        {/* Gold border bottom */}
        <div style={{ height: 4, background: '#D4AF37', width: '100%' }} />
      </div>
    ),
    {
      width:  1200,
      height: 630,
    }
  )
}
