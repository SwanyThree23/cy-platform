'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ChatMessage } from '@/types'

export function useChat(streamId: string, userId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || window.location.origin
    const socket = io(wsUrl, {
      path: '/api/socket',
      query: { streamId, userId },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('chat:history', (msgs: ChatMessage[]) => setMessages(msgs))
    socket.on('chat:message', (msg: ChatMessage) =>
      setMessages(prev => [...prev.slice(-199), msg])
    )
    socket.emit('chat:join', streamId)

    return () => { socket.disconnect() }
  }, [streamId, userId])

  const sendMessage = useCallback((content: string) => {
    socketRef.current?.emit('chat:send', { streamId, content })
  }, [streamId])

  const sendDonation = useCallback((content: string, amount: number) => {
    socketRef.current?.emit('chat:donation', { streamId, content, amount })
  }, [streamId])

  return { messages, connected, sendMessage, sendDonation }
}
