'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, Flag, Trash2, Ban, Search, Plus, X, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ChatMessage {
  id: string
  user_id: string
  username: string
  content: string
  created_at: string
  flagged?: boolean
  stream_id: string
}

interface BannedUser {
  user_id: string
  username: string
  banned_at: string
}

interface ChatModerationProps {
  streamId: string
}

const DEFAULT_KEYWORDS = ['spam', 'hate', 'scam', 'xxx', 'nude', 'kill', 'racist']

export default function ChatModeration({ streamId }: ChatModerationProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([])
  const [keywords, setKeywords] = useState<string[]>(DEFAULT_KEYWORDS)
  const [newKeyword, setNewKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'flagged'>('all')
  const [tab, setTab] = useState<'messages' | 'bans' | 'keywords'>('messages')

  const supabase = createClient()

  const isFlagged = useCallback((text: string) => {
    const lower = text.toLowerCase()
    return keywords.some(kw => lower.includes(kw.toLowerCase()))
  }, [keywords])

  useEffect(() => {
    fetchMessages()
    fetchBans()

    const channel = supabase
      .channel(`moderation:${streamId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `stream_id=eq.${streamId}`,
      }, payload => {
        const msg = payload.new as ChatMessage
        setMessages(prev => [{ ...msg, flagged: isFlagged(msg.content) }, ...prev].slice(0, 200))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [streamId, isFlagged])

  async function fetchMessages() {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (data) {
      setMessages(data.map(m => ({ ...m, flagged: isFlagged(m.content) })))
    }
  }

  async function fetchBans() {
    const { data } = await supabase
      .from('banned_users')
      .select('*')
      .eq('stream_id', streamId)
      .order('banned_at', { ascending: false })

    if (data) setBannedUsers(data)
  }

  async function deleteMessage(id: string) {
    await supabase.from('chat_messages').delete().eq('id', id)
    setMessages(prev => prev.filter(m => m.id !== id))
  }

  async function banUser(userId: string, username: string) {
    const { error } = await supabase.from('banned_users').insert({
      user_id: userId,
      username,
      stream_id: streamId,
      banned_at: new Date().toISOString(),
    })
    if (!error) {
      setBannedUsers(prev => [{ user_id: userId, username, banned_at: new Date().toISOString() }, ...prev])
      setMessages(prev => prev.filter(m => m.user_id !== userId))
    }
  }

  async function unbanUser(userId: string) {
    await supabase.from('banned_users').delete().eq('user_id', userId).eq('stream_id', streamId)
    setBannedUsers(prev => prev.filter(b => b.user_id !== userId))
  }

  function addKeyword() {
    const kw = newKeyword.trim().toLowerCase()
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw])
      setNewKeyword('')
    }
  }

  const displayed = messages.filter(m => {
    if (filter === 'flagged' && !m.flagged) return false
    if (search && !m.content.toLowerCase().includes(search.toLowerCase()) && !m.username.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const flaggedCount = messages.filter(m => m.flagged).length

  return (
    <div className="glass rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-gold" />
          <h3 className="font-semibold text-white">Chat Moderation</h3>
        </div>
        {flaggedCount > 0 && (
          <span className="flex items-center gap-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
            <AlertTriangle size={11} /> {flaggedCount} flagged
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['messages', 'bans', 'keywords'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${tab === t ? 'text-gold border-b-2 border-gold' : 'text-gray-400 hover:text-white'}`}
          >
            {t}
            {t === 'bans' && bannedUsers.length > 0 && <span className="ml-1 text-gray-500">({bannedUsers.length})</span>}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Messages tab */}
        {tab === 'messages' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold/50"
                  placeholder="Search messages…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => setFilter(f => f === 'all' ? 'flagged' : 'all')}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${filter === 'flagged' ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
              >
                <Flag size={13} />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {displayed.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">No messages</p>
              ) : (
                displayed.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${msg.flagged ? 'border-red-500/30 bg-red-500/10' : 'border-white/5 bg-white/3 hover:bg-white/5'}`}
                  >
                    {msg.flagged && <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-gold truncate">{msg.username}</span>
                        <span className="text-xs text-gray-600">{new Date(msg.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-sm text-gray-300 break-words">{msg.content}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        title="Delete message"
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        onClick={() => banUser(msg.user_id, msg.username)}
                        title="Ban user"
                        className="p-1.5 rounded-lg hover:bg-orange-500/20 text-gray-500 hover:text-orange-400 transition-colors"
                      >
                        <Ban size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Bans tab */}
        {tab === 'bans' && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {bannedUsers.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-8">No banned users</p>
            ) : (
              bannedUsers.map(b => (
                <div key={b.user_id} className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <div>
                    <p className="text-sm font-medium text-white">{b.username}</p>
                    <p className="text-xs text-gray-500">{new Date(b.banned_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => unbanUser(b.user_id)}
                    className="text-xs text-orange-400 hover:text-orange-300 border border-orange-500/30 px-2 py-1 rounded"
                  >
                    Unban
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Keywords tab */}
        {tab === 'keywords' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold/50"
                placeholder="Add blocked keyword…"
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKeyword()}
              />
              <button
                onClick={addKeyword}
                className="px-3 py-2 bg-gold/20 border border-gold/40 rounded-lg text-gold hover:bg-gold/30 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {keywords.map(kw => (
                <span key={kw} className="flex items-center gap-1.5 px-3 py-1 bg-red-500/15 border border-red-500/25 rounded-full text-xs text-red-300">
                  {kw}
                  <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}>
                    <X size={10} className="hover:text-red-200" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-600">Messages containing these words are auto-flagged.</p>
          </div>
        )}
      </div>
    </div>
  )
}
