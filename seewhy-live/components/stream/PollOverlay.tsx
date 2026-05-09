'use client'

import { useState, useEffect } from 'react'
import { BarChart2, X, Plus, Send, ChevronDown, ChevronUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { createClient } from '@/lib/supabase/client'

interface PollOption {
  id: string
  text: string
  votes: number
}

interface Poll {
  id: string
  question: string
  options: PollOption[]
  status: 'active' | 'ended'
  created_at: string
  stream_id: string
  total_votes: number
}

interface PollOverlayProps {
  streamId: string
  isHost?: boolean
  userId?: string
  // alternate prop names from LiveRoom
  hostId?: string
  currentUserId?: string | null
  onClose?: () => void
}

const COLORS = ['#FFD700', '#a78bfa', '#34d399', '#60a5fa', '#f87171', '#fb923c']

export function PollOverlay({ streamId, isHost: isHostProp, userId, hostId, currentUserId, onClose }: PollOverlayProps) {
  const resolvedUserId = userId ?? currentUserId ?? undefined
  const isHost = isHostProp ?? (!!hostId && !!currentUserId && hostId === currentUserId)
  void onClose // available for caller to dismiss if needed
  const [poll, setPoll] = useState<Poll | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [creating, setCreating] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [votedOption, setVotedOption] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchActivePoll()

    const channel = supabase
      .channel(`poll:${streamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'polls',
        filter: `stream_id=eq.${streamId}`,
      }, () => fetchActivePoll())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'poll_votes',
      }, () => fetchActivePoll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [streamId])

  async function fetchActivePoll() {
    const { data } = await supabase
      .from('polls')
      .select('*, poll_options(id, text, votes)')
      .eq('stream_id', streamId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      const opts: PollOption[] = (data.poll_options || []).map((o: { id: string; text: string; votes: number }) => ({
        id: o.id,
        text: o.text,
        votes: o.votes || 0,
      }))
      setPoll({
        id: data.id,
        question: data.question,
        options: opts,
        status: data.status,
        created_at: data.created_at,
        stream_id: data.stream_id,
        total_votes: opts.reduce((s, o) => s + o.votes, 0),
      })
    } else {
      // Check for recently ended poll to show results briefly
      const { data: ended } = await supabase
        .from('polls')
        .select('*, poll_options(id, text, votes)')
        .eq('stream_id', streamId)
        .eq('status', 'ended')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (ended) {
        const opts: PollOption[] = (ended.poll_options || []).map((o: { id: string; text: string; votes: number }) => ({
          id: o.id,
          text: o.text,
          votes: o.votes || 0,
        }))
        setPoll({
          id: ended.id,
          question: ended.question,
          options: opts,
          status: 'ended',
          created_at: ended.created_at,
          stream_id: ended.stream_id,
          total_votes: opts.reduce((s, o) => s + o.votes, 0),
        })
      } else {
        setPoll(null)
      }
    }
  }

  async function createPoll() {
    const validOptions = options.filter(o => o.trim())
    if (!question.trim() || validOptions.length < 2) return
    setSubmitting(true)

    const res = await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stream_id: streamId, question: question.trim(), options: validOptions }),
    })

    if (res.ok) {
      setCreating(false)
      setQuestion('')
      setOptions(['', ''])
      fetchActivePoll()
    }
    setSubmitting(false)
  }

  async function vote(optionId: string) {
    if (votedOption || !resolvedUserId) return
    setVotedOption(optionId)

    await fetch(`/api/polls/${poll?.id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: optionId, user_id: resolvedUserId }),
    })
    fetchActivePoll()
  }

  async function endPoll() {
    if (!poll) return
    await fetch(`/api/polls/${poll.id}/end`, { method: 'POST' })
    fetchActivePoll()
  }

  const chartData = poll?.options.map(o => ({
    name: o.text.length > 16 ? o.text.slice(0, 16) + '…' : o.text,
    votes: o.votes,
  })) || []

  if (!poll && !isHost) return null

  return (
    <div className="fixed bottom-24 right-4 z-40 w-72">
      {/* Host create button when no poll */}
      {!poll && isHost && !creating && (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gold/20 border border-gold/40 rounded-lg text-gold text-sm hover:bg-gold/30 transition-colors"
        >
          <BarChart2 size={16} />
          Launch Poll
        </button>
      )}

      {/* Create poll form */}
      {creating && isHost && (
        <div className="glass rounded-xl border border-gold/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gold font-semibold text-sm flex items-center gap-2"><BarChart2 size={15} />New Poll</span>
            <button onClick={() => setCreating(false)}><X size={16} className="text-gray-400 hover:text-white" /></button>
          </div>

          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold/50"
            placeholder="Ask a question…"
            value={question}
            onChange={e => setQuestion(e.target.value)}
          />

          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold/50"
                  placeholder={`Option ${i + 1}`}
                  value={opt}
                  onChange={e => { const n = [...options]; n[i] = e.target.value; setOptions(n) }}
                />
                {options.length > 2 && (
                  <button onClick={() => setOptions(options.filter((_, j) => j !== i))}><X size={14} className="text-gray-500 hover:text-red-400" /></button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <button onClick={() => setOptions([...options, ''])} className="text-xs text-gray-400 hover:text-gold flex items-center gap-1">
                <Plus size={12} /> Add option
              </button>
            )}
          </div>

          <button
            onClick={createPoll}
            disabled={submitting}
            className="w-full py-2 bg-gold text-black font-bold rounded-lg text-sm hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={14} /> Launch
          </button>
        </div>
      )}

      {/* Active / ended poll display */}
      {poll && !creating && (
        <div className="glass rounded-xl border border-gold/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gold/10 border-b border-gold/20">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-gold" />
              <span className="text-xs font-semibold text-gold">{poll.status === 'active' ? 'LIVE POLL' : 'POLL ENDED'}</span>
            </div>
            <div className="flex items-center gap-2">
              {isHost && poll.status === 'active' && (
                <button onClick={endPoll} className="text-xs text-red-400 hover:text-red-300">End</button>
              )}
              <button onClick={() => setMinimized(!minimized)}>
                {minimized ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>
            </div>
          </div>

          {!minimized && (
            <div className="p-4 space-y-3">
              <p className="text-white text-sm font-medium">{poll.question}</p>

              {/* Viewer voting buttons */}
              {poll.status === 'active' && !isHost && !votedOption && (
                <div className="space-y-2">
                  {poll.options.map((opt, i) => (
                    <button
                      key={opt.id}
                      onClick={() => vote(opt.id)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-white/10 hover:border-gold/40 bg-white/5 hover:bg-gold/10 text-sm text-white transition-all"
                    >
                      <span className="mr-2 text-gold text-xs font-bold">{String.fromCharCode(65 + i)}.</span>
                      {opt.text}
                    </button>
                  ))}
                </div>
              )}

              {/* Results bar chart */}
              {(isHost || votedOption || poll.status === 'ended') && (
                <>
                  <ResponsiveContainer width="100%" height={poll.options.length * 32 + 10}>
                    <BarChart layout="vertical" data={chartData} margin={{ left: 0, right: 24 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#ccc', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={false}
                        contentStyle={{ background: '#1a1a2e', border: '1px solid #FFD700', borderRadius: 8 }}
                        itemStyle={{ color: '#FFD700' }}
                        formatter={(v: number) => [`${v} votes`]}
                      />
                      <Bar dataKey="votes" radius={[0, 4, 4, 0]}>
                        {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-500 text-right">{poll.total_votes} votes</p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
