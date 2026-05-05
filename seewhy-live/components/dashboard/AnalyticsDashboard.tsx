'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Users, Clock, DollarSign, Eye, MessageSquare } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'

interface StreamStat {
  id: string
  title: string
  peak_viewers: number
  total_viewers: number
  duration_seconds: number
  revenue_cents: number
  chat_messages: number
  started_at: string
  category: string
}

interface AnalyticsDashboardProps {
  userId: string
}

const COLORS = ['#FFD700', '#a78bfa', '#34d399', '#60a5fa', '#f87171']

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-xl border border-white/10 p-4 flex items-center gap-4">
      <div className="p-2.5 rounded-xl bg-gold/15 text-gold">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}

export default function AnalyticsDashboard({ userId }: AnalyticsDashboardProps) {
  const [streams, setStreams] = useState<StreamStat[]>([])
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('30d')
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchStats()
  }, [range, userId])

  async function fetchStats() {
    setLoading(true)
    let query = supabase
      .from('streams')
      .select('id, title, peak_viewers, total_viewers, duration_seconds, revenue_cents, chat_messages, started_at, category')
      .eq('user_id', userId)
      .eq('status', 'ended')
      .order('started_at', { ascending: false })

    if (range !== 'all') {
      const days = range === '7d' ? 7 : 30
      const from = new Date(Date.now() - days * 86400_000).toISOString()
      query = query.gte('started_at', from)
    }

    const { data } = await query.limit(50)
    setStreams(data || [])
    setLoading(false)
  }

  // Viewer trend — daily peak across streams
  const viewerTrend = (() => {
    const map: Record<string, number> = {}
    streams.forEach(s => {
      const day = new Date(s.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      map[day] = Math.max(map[day] || 0, s.peak_viewers || 0)
    })
    return Object.entries(map).slice(-14).map(([date, viewers]) => ({ date, viewers }))
  })()

  // Category distribution
  const categoryData = (() => {
    const map: Record<string, number> = {}
    streams.forEach(s => { map[s.category || 'Other'] = (map[s.category || 'Other'] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  })()

  // Engagement funnel
  const funnelData = streams.slice(0, 10).map(s => ({
    name: s.title?.slice(0, 14) || 'Stream',
    viewers: s.total_viewers || 0,
    chat: s.chat_messages || 0,
  }))

  const totalViewers = streams.reduce((s, r) => s + (r.total_viewers || 0), 0)
  const totalRevenue = streams.reduce((s, r) => s + (r.revenue_cents || 0), 0)
  const totalMinutes = streams.reduce((s, r) => s + (r.duration_seconds || 0), 0)
  const avgPeak = streams.length ? Math.round(streams.reduce((s, r) => s + (r.peak_viewers || 0), 0) / streams.length) : 0

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <TrendingUp size={20} className="text-gold" /> Analytics
        </h2>
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(['7d', '30d', 'all'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${range === r ? 'bg-gold text-black' : 'text-gray-400 hover:text-white'}`}
            >
              {r === 'all' ? 'All time' : `Last ${r}`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading analytics…</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Eye} label="Total Views" value={fmt(totalViewers)} sub={`${streams.length} streams`} />
            <StatCard icon={Users} label="Avg Peak" value={fmt(avgPeak)} sub="viewers per stream" />
            <StatCard icon={Clock} label="Air Time" value={`${Math.round(totalMinutes / 3600)}h`} sub={`${Math.round(totalMinutes / 60)} mins total`} />
            <StatCard icon={DollarSign} label="Revenue" value={`$${(totalRevenue / 100).toFixed(2)}`} sub="subscriptions" />
          </div>

          {/* Viewer trend area chart */}
          {viewerTrend.length > 0 && (
            <div className="glass rounded-xl border border-white/10 p-4">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={15} className="text-gold" /> Peak Viewer Trend
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={viewerTrend}>
                  <defs>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 8 }}
                    itemStyle={{ color: '#FFD700' }}
                  />
                  <Area type="monotone" dataKey="viewers" stroke="#FFD700" strokeWidth={2} fill="url(#goldGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Category pie chart */}
            {categoryData.length > 0 && (
              <div className="glass rounded-xl border border-white/10 p-4">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <MessageSquare size={15} className="text-gold" /> Stream Categories
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                      {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 8 }}
                      itemStyle={{ color: '#e5e7eb' }}
                    />
                    <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Engagement funnel bar chart */}
            {funnelData.length > 0 && (
              <div className="glass rounded-xl border border-white/10 p-4">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Users size={15} className="text-gold" /> Viewers vs Chat
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={funnelData} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 8 }}
                      itemStyle={{ color: '#e5e7eb' }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                    <Bar dataKey="viewers" fill="#FFD700" radius={[3, 3, 0, 0]} name="Viewers" />
                    <Bar dataKey="chat" fill="#a78bfa" radius={[3, 3, 0, 0]} name="Chat msgs" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Recent streams table */}
          {streams.length > 0 && (
            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">Recent Streams</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-white/5">
                      <th className="text-left px-4 py-2">Stream</th>
                      <th className="text-right px-4 py-2">Peak</th>
                      <th className="text-right px-4 py-2">Duration</th>
                      <th className="text-right px-4 py-2">Chat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {streams.slice(0, 8).map(s => (
                      <tr key={s.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="text-white font-medium truncate max-w-[160px]">{s.title || 'Untitled'}</p>
                          <p className="text-gray-500 text-xs">{new Date(s.started_at).toLocaleDateString()}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gold font-medium">{fmt(s.peak_viewers || 0)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">{Math.round((s.duration_seconds || 0) / 60)}m</td>
                        <td className="px-4 py-2.5 text-right text-gray-300">{fmt(s.chat_messages || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {streams.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
              <p>No stream data yet. Go live to start collecting analytics.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
