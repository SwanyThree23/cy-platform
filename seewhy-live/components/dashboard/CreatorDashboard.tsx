'use client'
import { useState } from 'react'
import {
  Radio, Eye, TrendingUp, Settings, Play, Square, Copy, Check,
  Shield, BarChart2, Video, Share2,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import AnalyticsDashboard from './AnalyticsDashboard'
import ChatModeration from './ChatModeration'
import VideoPost from '@/components/video/VideoPost'
import ChatterSocialShare from '@/components/share/ChatterSocialShare'
import type { Profile, Stream } from '@/types'

interface Props {
  profile: Profile | null
  recentStreams: Stream[]
  totalViews: number
}

type Tab = 'overview' | 'go-live' | 'analytics' | 'moderation' | 'video' | 'settings'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',    label: 'Overview',    icon: Radio },
  { id: 'go-live',     label: 'Go Live',     icon: Play },
  { id: 'analytics',   label: 'Analytics',   icon: TrendingUp },
  { id: 'moderation',  label: 'Moderation',  icon: Shield },
  { id: 'video',       label: 'Video Post',  icon: Video },
  { id: 'settings',    label: 'Settings',    icon: Settings },
]

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://seewhylive.online'

export function CreatorDashboard({ profile, recentStreams, totalViews }: Props) {
  const [tab, setTab]           = useState<Tab>('overview')
  const [isLive, setIsLive]     = useState(false)
  const [activeStream, setActiveStream] = useState<Stream | null>(null)
  const [copied, setCopied]     = useState('')
  const [streamTitle, setStreamTitle] = useState('My Live Stream')
  const [streamCategory, setStreamCategory] = useState('TALK')
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState('')

  // Payment handle state (pre-populate from profile)
  const [handles, setHandles]   = useState({
    cashapp: (profile as any)?.cashapp_handle ?? '',
    paypal:  (profile as any)?.paypal_handle  ?? '',
    venmo:   (profile as any)?.venmo_handle   ?? '',
    zelle:   (profile as any)?.zelle_handle   ?? '',
    chime:   (profile as any)?.chime_handle   ?? '',
  })

  const rtmpUrl   = `rtmp://2.24.198.112:1935/live`
  const streamKey = profile?.id ? `sk_${profile.id.replace(/-/g, '').slice(0, 24)}` : 'sk_generate_key_first'

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  async function handleGoLive() {
    const res = await fetch('/api/streams', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title: streamTitle, category: streamCategory }),
    })
    if (res.ok) {
      const stream = await res.json()
      setActiveStream(stream)
      setIsLive(true)
    }
  }

  async function handleEndStream() {
    await fetch('/api/streams/end', { method: 'POST' })
    setIsLive(false)
    setActiveStream(null)
  }

  async function saveHandles() {
    if (!profile?.id) return
    setSaving(true)
    const res = await fetch('/api/profile', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(handles),
    })
    setSaveMsg(res.ok ? 'Saved!' : 'Save failed')
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const viewData = recentStreams.slice(0, 7).map((s, i) => ({
    name:    `#${i + 1}`,
    viewers: s.peak_viewers ?? 0,
  })).reverse()

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white">Creator Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome back, {profile?.display_name ?? 'Creator'}</p>
        </div>
        <div className="flex items-center gap-3">
          {isLive && activeStream && (
            <ChatterSocialShare
              streamId={activeStream.id}
              title={activeStream.title}
              creatorName={profile?.display_name ?? 'Creator'}
              handle={profile?.username ?? ''}
              watchUrl={`${BASE_URL}/watch/${activeStream.id}`}
              viewerCount={0}
              isLive={true}
              tipEnabled={true}
            />
          )}
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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 rounded-xl bg-white/5 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tab === id ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Streams',  value: recentStreams.length },
              { label: 'Total Views',    value: totalViews.toLocaleString() },
              { label: 'Followers',      value: (profile?.follower_count ?? 0).toLocaleString() },
              { label: 'Avg Viewers',    value: recentStreams.length ? Math.floor(totalViews / recentStreams.length) : 0 },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-4 glass border border-white/10">
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-gray-400 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {viewData.length > 0 && (
            <div className="rounded-xl p-5 glass border border-white/10">
              <h3 className="text-white font-semibold mb-4">Peak Viewers — Recent Streams</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={viewData}>
                  <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8 }} itemStyle={{ color: '#FFD700' }} />
                  <Bar dataKey="viewers" fill="#FFD700" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="rounded-xl glass border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-white font-semibold">Recent Streams</h3>
            </div>
            {recentStreams.length === 0 ? (
              <p className="px-5 py-8 text-gray-500 text-center">No streams yet — go live to get started!</p>
            ) : (
              <div className="divide-y divide-white/5">
                {recentStreams.map(s => (
                  <div key={s.id} className="px-5 py-3 flex items-center justify-between hover:bg-white/3 transition-colors">
                    <div>
                      <p className="text-white text-sm font-medium">{s.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gold text-sm font-bold">{s.peak_viewers ?? 0} peak</p>
                      <p className="text-gray-500 text-xs capitalize">{s.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Go Live ── */}
      {tab === 'go-live' && (
        <div className="space-y-6">
          {/* Stream setup */}
          <div className="rounded-xl p-5 glass border border-white/10 space-y-4">
            <h3 className="text-white font-semibold">Stream Setup</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Title</label>
                <input
                  value={streamTitle}
                  onChange={e => setStreamTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-gold/40"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Category</label>
                <select
                  value={streamCategory}
                  onChange={e => setStreamCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-gold/40"
                >
                  {['TALK', 'MUSIC', 'GAMING', 'SPORTS', 'EDUCATION', 'TECH', 'COMEDY', 'OTHER'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* RTMP credentials */}
          <div className="rounded-xl p-5 glass border border-white/10">
            <h3 className="text-white font-semibold mb-1">OBS / Streaming Software</h3>
            <p className="text-gray-400 text-sm mb-5">Enter these in your streaming software settings.</p>
            <div className="space-y-4">
              {[
                { label: 'RTMP Server URL', value: rtmpUrl,    key: 'rtmp' },
                { label: 'Stream Key',      value: streamKey,  key: 'key', secret: true },
              ].map(({ label, value, key, secret }) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">{label}</label>
                  <div className="flex gap-2">
                    <input readOnly type={secret ? 'password' : 'text'} value={value}
                      className="flex-1 px-3 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm font-mono" />
                    <button onClick={() => copy(value, key)}
                      className="px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
                      {copied === key ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment handles */}
          <div className="rounded-xl p-5 glass border border-white/10">
            <h3 className="text-white font-semibold mb-1">Direct Tip Links</h3>
            <p className="text-gray-400 text-sm mb-4">Shown to viewers during your stream — 100% goes directly to you.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {([
                { id: 'cashapp', label: 'Cash App',    placeholder: '$yourcashtag' },
                { id: 'paypal',  label: 'PayPal',      placeholder: 'paypal.me/yourname' },
                { id: 'venmo',   label: 'Venmo',       placeholder: '@yourvenmo' },
                { id: 'zelle',   label: 'Zelle',       placeholder: 'phone or email' },
                { id: 'chime',   label: 'Chime',       placeholder: '$chimepay tag' },
              ] as const).map(({ id, label, placeholder }) => (
                <div key={id}>
                  <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">{label}</label>
                  <input
                    value={handles[id]}
                    onChange={e => setHandles(h => ({ ...h, [id]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gold/40"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={saveHandles}
                disabled={saving}
                className="px-5 py-2 rounded-lg text-black font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
              >
                {saving ? 'Saving…' : 'Save Handles'}
              </button>
              {saveMsg && <span className="text-sm text-green-400">{saveMsg}</span>}
            </div>
          </div>

          {/* evmux guest link */}
          <div className="rounded-xl p-5 glass border border-gold/20">
            <h3 className="text-white font-semibold mb-1">🎬 Invite Guests via evmux</h3>
            <p className="text-gray-400 text-sm mb-3">Share this link with up to 20 guests — no software download required.</p>
            <div className="flex gap-2">
              <input readOnly value={process.env.NEXT_PUBLIC_EVMUX_GUEST_URL || 'configure NEXT_PUBLIC_EVMUX_GUEST_URL in .env'}
                className="flex-1 px-3 py-2.5 rounded-lg bg-black/30 border border-gold/20 text-gold text-sm font-mono" />
              <button onClick={() => copy(process.env.NEXT_PUBLIC_EVMUX_GUEST_URL || '', 'guest')}
                className="px-3 py-2.5 rounded-lg bg-gold/10 hover:bg-gold/20 text-gold transition-colors border border-gold/25">
                {copied === 'guest' ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Analytics ── */}
      {tab === 'analytics' && profile && (
        <AnalyticsDashboard userId={profile.id} />
      )}

      {/* ── Moderation ── */}
      {tab === 'moderation' && (
        <div className="space-y-4">
          {isLive && activeStream ? (
            <ChatModeration streamId={activeStream.id} />
          ) : recentStreams.length > 0 ? (
            <ChatModeration streamId={recentStreams[0].id} />
          ) : (
            <div className="glass rounded-xl border border-white/10 p-12 text-center">
              <Shield size={40} className="mx-auto mb-3 text-gray-600" />
              <p className="text-gray-500">No streams yet — go live to access moderation.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Video Post ── */}
      {tab === 'video' && profile && (
        <div className="max-w-lg">
          <VideoPost
            userId={profile.id}
            onUploaded={(url, duration) => {
              console.log(`Video posted: ${url} (${duration}s)`)
            }}
          />
        </div>
      )}

      {/* ── Settings ── */}
      {tab === 'settings' && (
        <div className="rounded-xl p-5 glass border border-white/10 space-y-4 max-w-lg">
          <h3 className="text-white font-semibold">Profile Settings</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Display Name', defaultValue: profile?.display_name ?? '' },
              { label: 'Username',     defaultValue: profile?.username ?? '' },
            ].map(({ label, defaultValue }) => (
              <div key={label}>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">{label}</label>
                <input
                  defaultValue={defaultValue}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-gold/40"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wide mb-1 block">Bio</label>
            <textarea
              defaultValue={profile?.bio ?? ''}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-gold/40 resize-none"
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
