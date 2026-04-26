'use client'
import { useRef, useEffect, useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { Send, Wifi, WifiOff } from 'lucide-react'
import type { ChatMessage } from '@/types'

interface Props {
  streamId: string
  currentUserId: string | null
}

export function StreamChat({ streamId, currentUserId }: Props) {
  const { messages, connected, sendMessage } = useChat(streamId, currentUserId)
  const [input, setInput]   = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !currentUserId) return
    sendMessage(text)
    setInput('')
  }

  return (
    <div className="flex flex-col h-[600px] xl:h-[calc(100vh-120px)] rounded-xl border border-brand-border bg-brand-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
        <h3 className="text-white font-semibold text-sm">Live Chat</h3>
        <span className={`flex items-center gap-1 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          {connected ? 'Live' : 'Reconnecting'}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.map(msg => (
          <ChatBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-brand-border">
        {currentUserId ? (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Say something..."
              maxLength={300}
              className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-yellow-500/40"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-3 py-2 rounded-lg text-black font-bold transition-all hover:scale-105 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
            >
              <Send size={15} />
            </button>
          </div>
        ) : (
          <a
            href="/login"
            className="block text-center py-2 text-sm text-yellow-400 hover:text-yellow-300"
          >
            Sign in to chat →
          </a>
        )}
      </form>
    </div>
  )
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  if (msg.is_donation) {
    return (
      <div className="rounded-lg p-2.5 border border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-yellow-400 font-bold text-xs">{msg.username}</span>
          <span className="text-yellow-400 text-xs">💰 ${((msg.donation_amount ?? 0) / 100).toFixed(2)}</span>
        </div>
        <p className="text-white text-sm">{msg.content}</p>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-start group">
      <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex-shrink-0 flex items-center justify-center text-xs text-yellow-400 font-bold mt-0.5">
        {msg.username[0]?.toUpperCase()}
      </div>
      <div className="min-w-0">
        <span className="text-yellow-400 text-xs font-medium mr-1.5">{msg.username}</span>
        <span className="text-gray-200 text-sm">{msg.content}</span>
      </div>
    </div>
  )
}
