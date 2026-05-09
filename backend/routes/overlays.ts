/**
 * routes/overlays.ts — SSE overlay event stream + manual trigger endpoint
 * Overlay HTML pages (served as static files) connect to GET /api/overlays/events
 */

import { Router } from 'express'
import {
  addOverlayClient,
  removeOverlayClient,
  publishOverlayEvent,
  startHeartbeat,
} from '../src/integrations/evmux'

const router = Router()

/** GET /api/overlays/events?streamId=xxx — opens SSE connection */
router.get('/events', (req, res) => {
  const streamId = req.query.streamId as string
  if (!streamId) {
    res.status(400).json({ error: 'streamId query param required' })
    return
  }

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering
  })

  res.write(':connected\n\n')

  addOverlayClient(streamId, res)
  const heartbeat = startHeartbeat(streamId, res)

  req.on('close', () => {
    clearInterval(heartbeat)
    removeOverlayClient(streamId, res)
  })
})

/** POST /api/overlays/trigger — send overlay event from Director panel */
router.post('/trigger', (req, res) => {
  const { streamId, event, data } = req.body as {
    streamId: string
    event:    string
    data:     Record<string, unknown>
  }

  if (!streamId || !event) {
    res.status(400).json({ error: 'streamId and event required' })
    return
  }

  publishOverlayEvent(streamId, event, data ?? {})
  res.json({ ok: true, event, streamId })
})

export default router

// Named export for use inside Stripe webhook handler
export { publishOverlayEvent }
