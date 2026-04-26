'use client'
import { useState } from 'react'
import { Radio, Eye, TrendingUp, Settings, Play, Square, Copy, Check } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { Profile, Stream } from '@/types'

interface Props {
  profile: Profile | null
  recentStreams: Stream[]
  totalViews: number
}

export function CreatorDashboard({ profile, recentStreams, totalViews }: Props) {
  const [tab, setTab]       = useState<'overview' | 'go-live' | 'settings'>('overview')
  const [isLive, setIsLive] = useState(false)
  const [copied, setCopied] = useState('')

  const rtmpUrl = `rtmp://2.24.198.112:1935/live`
  const streamKey = profile?.id ? `sk_${profile.id.replace(/-/g, '').slice(0, 24)}` : 'sk_generate_key_first'

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  async function handleGoLive() {
    const res = await fetch('/api/streams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My Live Stream', category: 'TALK' }),
    })
    if (res.ok) setIsLive(true)
  }

  async function handleEndStream() {
    await fetch('/api/streams/end', { method: 'POST' })
    setIsLive(false)
  }

  const viewData = recentStreams.slice(0, 7).map((s, i) => ({
    name: `Stream ${i + 1}`,
    viewers: s.peak_viewers ?? 0,
  })).reverse()

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">Creator Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome back, {profile?.display_name ?? 'Creator'}</p>
        </div>
        {isLive ? (
          <button
            onClick={handleEndStream}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
          >
            <Square size={16} /> End Stream
          </button>
        ) : (
          <button
            onClick={handleGoLive}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-black font-bold transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
          >
            <Play size={16} /> Go Live
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 rounded-xl bg-brand-surface w-fit">
        {(['overview', 'go-live', 'settings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Streams', value: recentStreams.length, icon: Radio },
              { label: 'Total Views', value: totalViews.toLocaleString(), icon: Eye },
              { label: 'Followers', value: (profile?.follower_count ?? 0).toLocaleString(), icon: TrendingUp },
              { label: 'Avg Viewers', value: recentStreams.length ? Math.round(totalViews / recentStreams.length) : 0, icon: Eye },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl p-4 bg-brand-card border border-brand-border">
                <Icon size={18} className="text-yellow-400 mb-2" />
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-gray-400 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          {viewData.length > 0 && (
            <div className="rounded-xl p-5 bg-brand-card border border-brand-border">
              <h3 className="text-white font-semibold mb-4">Peak Viewers per Stream</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={viewData}>
                  <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8 }} />
                  <Bar dataKey="viewers" fill="#FFD700" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent Streams */}
          <div className="rounded-xl bg-brand-card border border-brand-border overflow-hidden">
            <div className="px-5 py-4 border-b border-brand-border">
              <h3 className="text-white font-semibold">Recent Streams</h3>
            </div>
            {recentStreams.length === 0 ? (
              <p className="px-5 py-8 text-gray-500 text-center">No streams yet — go live to get started!</p>
            ) : (
              <div className="divide-y divide-brand-border">
                {recentStreams.map(stream => (
                  <div key={stream.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-medium">{stream.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{new Date(stream.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-yellow-400 text-sm font-bold">{stream.peak_viewers ?? 0} peak</p>
                      <p className="text-gray-500 text-xs capitalize">{stream.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Go Live Tab */}
      {tab === 'go-live' && (
        <div className="space-y-6">
          <div className="rounded-xl p-5 bg-brand-card border border-brand-border">
            <h3 className="text-white font-semibold mb-1">OBS / Streaming Software Setup</h3>
            <p className="text-gray-400 text-sm mb-5">Enter these values in your streaming software settings.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">RTMP Server URL</label>
                <div className="flex gap-2">
                  <input readOnly value={rtmpUrl} className="flex-1 px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm font-mono" />
                  <button onClick={() => copy(rtmpUrl, 'rtmp')} className="px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
                    {copied === 'rtmp' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Stream Key</label>
                <div className="flex gap-2">
                  <input readOnly type="password" value={streamKey} className="flex-1 px-3 py-2.5 rounded-lg bg-black/30 border border-yellow-500/20 text-white text-sm font-mono" />
                  <button onClick={() => copy(streamKey, 'key')} className="px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
                    {copied === 'key' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="text-yellow-600 text-xs mt-1.5">Keep your stream key private — treat it like a password.</p>
              </div>
            </div>
          </div>

          {/* Payment handles */}
          <div className="rounded-xl p-5 bg-brand-card border border-brand-border">
            <h3 className="text-white font-semibold mb-1">Zero-Fee Tip Links</h3>
            <p className="text-gray-400 text-sm mb-4">100% of tips go directly to you — no platform cut.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: 'Cash App', placeholder: '$yourcashtag' },
                { label: 'PayPal', placeholder: 'paypal.me/yourname' },
                { label: 'Venmo', placeholder: '@yourvenmo' },
                { label: 'Zelle', placeholder: 'phone or email' },
              ].map(({ label, placeholder }) => (
                <div key={label}>
                  <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">{label}</label>
                  <input
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-500/40"
                  />
                </div>
              ))}
            </div>
            <button className="mt-4 px-5 py-2 rounded-lg text-black font-bold text-sm" style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
              Save Payment Handles
            </button>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="rounded-xl p-5 bg-brand-card border border-brand-border space-y-4">
          <h3 className="text-white font-semibold">Profile Settings</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Display Name', key: 'display_name', value: profile?.display_name ?? '' },
              { label: 'Username', key: 'username', value: profile?.username ?? '' },
            ].map(({ label, key, value }) => (
              <div key={key}>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">{label}</label>
                <input
                  defaultValue={value}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-yellow-500/40"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Bio</label>
            <textarea
              defaultValue={profile?.bio ?? ''}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-yellow-500/40 resize-none"
            />
          </div>
          <button className="px-5 py-2 rounded-lg text-black font-bold text-sm" style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}>
            Save Changes
          </button>
        </div>
      )}
    </div>
  )
}
