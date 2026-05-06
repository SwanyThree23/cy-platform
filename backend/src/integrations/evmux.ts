/**
 * evmux integration — SSE overlay event bus.
 * Uses in-process EventEmitter (no Redis dependency).
 * Each overlay HTML page connects via GET /api/overlays/events?streamId=xxx.
 */

import { EventEmitter } from 'events'
import type { Response } from 'express'

const overlayBus = new EventEmitter()
overlayBus.setMaxListeners(500) // many simultaneous overlays allowed

// Active SSE connections keyed by streamId → Set<Response>
const sseClients = new Map<string, Set<Response>>()

/** Register an SSE client for a stream */
export function addOverlayClient(streamId: string, res: Response): void {
  if (!sseClients.has(streamId)) sseClients.set(streamId, new Set())
  sseClients.get(streamId)!.add(res)
  overlayBus.emit('client-count', streamId, sseClients.get(streamId)!.size)
}

/** Remove an SSE client (on disconnect) */
export function removeOverlayClient(streamId: string, res: Response): void {
  sseClients.get(streamId)?.delete(res)
  if (sseClients.get(streamId)?.size === 0) sseClients.delete(streamId)
}

/** Publish an event to all overlay clients for a stream */
export function publishOverlayEvent(
  streamId: string,
  eventType: string,
  data: Record<string, unknown>
): void {
  const clients = sseClients.get(streamId)
  if (!clients || clients.size === 0) return

  const payload = JSON.stringify({ type: eventType, ...data })
  const sseMsg  = `event: ${eventType}\ndata: ${payload}\n\n`

  for (const res of clients) {
    try {
      res.write(sseMsg)
    } catch {
      clients.delete(res)
    }
  }
}

/** Heartbeat — keep SSE connections alive through proxies */
export function startHeartbeat(streamId: string, res: Response): NodeJS.Timeout {
  return setInterval(() => {
    try { res.write(':ping\n\n') } catch { clearInterval }
  }, 20_000)
}

export const evmuxConfig = {
  ingestUrl:  process.env.EVMUX_INGEST_URL  || 'rtmp://rtmp1.us-east-1.evmux.com/live',
  streamKey:  process.env.EVMUX_STREAM_KEY  || '',
  token:      process.env.EVMUX_TOKEN       || '',
  guestUrl:   process.env.EVMUX_GUEST_URL   || '',
}
