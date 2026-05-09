/**
 * routes/stream-status.ts
 * PATCH /api/streams/:id/status — go-live / end-stream with full side-effect chain.
 * Only register this route if PATCH /api/streams/:id/status is NOT already handled
 * in server.ts. Check before importing!
 */

import { Router } from 'express'
import prisma from '../prisma'
import { publishOverlayEvent } from './overlays'
import { triggerN8nDistribution, triggerN8nChatterSocial } from '../src/integrations/social-distribution'
import { updateLumaEventOnGoLive, updateLumaEventOnEnd } from '../src/integrations/luma'

const router = Router()

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://seewhylive.online'

async function triggerGoLiveSideEffects(streamId: string): Promise<void> {
  const stream = await prisma.stream.findUnique({
    where:   { id: streamId },
    include: { creator: true },
  }).catch(() => null)

  if (!stream || !stream.creator) return

  const watchUrl    = `${BASE_URL}/watch/${streamId}`
  const creatorName = stream.creator.displayName || stream.creator.handle
  const handle      = stream.creator.handle

  // Luma event update (non-blocking)
  const lumaEventId = (stream as any).lumaEventId as string | null
  if (lumaEventId) {
    updateLumaEventOnGoLive(lumaEventId, stream).catch(console.error)
  }

  // ChatterSocial n8n announcer
  triggerN8nChatterSocial({
    streamId,
    title:       stream.title,
    creatorName,
    handle,
    watchUrl,
    viewerCount: (stream as any).viewerCount || 0,
    isLive:      true,
  }).catch(console.error)

  // Social distribution n8n workflow
  triggerN8nDistribution({
    id:          streamId,
    title:       stream.title,
    creatorName,
    handle,
    isLive:      true,
    viewerCount: (stream as any).viewerCount || 0,
    tipEnabled:  (stream as any).tipsEnabled ?? true,
    lumaEventId,
  }).catch(console.error)

  // Overlay SSE — broadcast go-live event
  publishOverlayEvent(streamId, 'stream-live', {
    title:    stream.title,
    creator:  creatorName,
    watchUrl,
  })

  console.log(`[StreamStatus] go-live side effects triggered for ${streamId}`)
}

async function triggerEndSideEffects(streamId: string): Promise<void> {
  const stream = await prisma.stream.findUnique({
    where:   { id: streamId },
    include: { creator: true },
  }).catch(() => null)

  if (!stream) return

  // Luma event end update
  const lumaEventId = (stream as any).lumaEventId as string | null
  if (lumaEventId) {
    updateLumaEventOnEnd(lumaEventId, stream).catch(console.error)
  }

  // Overlay SSE — broadcast stream-ended
  publishOverlayEvent(streamId, 'stream-ended', { streamId })

  console.log(`[StreamStatus] end side effects triggered for ${streamId}`)
}

/** PATCH /api/streams/:id/status { status: 'LIVE' | 'ENDED' } */
router.patch('/:id/status', async (req, res) => {
  const { id }     = req.params
  const { status } = req.body as { status?: string }

  if (!status || !['LIVE', 'ENDED'].includes(status)) {
    res.status(400).json({ error: 'status must be LIVE or ENDED' })
    return
  }

  const update: Record<string, unknown> = { status }
  if (status === 'LIVE')  update.startedAt = new Date()
  if (status === 'ENDED') update.endedAt   = new Date()

  const stream = await prisma.stream.update({
    where:   { id },
    data:    update,
    include: { creator: true },
  }).catch(err => { res.status(500).json({ error: err.message }); return null })

  if (!stream) return

  if (status === 'LIVE')  triggerGoLiveSideEffects(id).catch(console.error)
  if (status === 'ENDED') triggerEndSideEffects(id).catch(console.error)

  res.json(stream)
})

export { triggerGoLiveSideEffects, triggerEndSideEffects }
export default router
