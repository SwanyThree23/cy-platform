/**
 * routes/social-distribution.ts
 * POST /api/social/distribution/posts   — returns all 7 platform posts for a stream
 * GET  /api/social/distribution/status/:streamId — returns fanout_event status
 */

import { Router } from 'express'
import prisma from '../prisma'
import { buildAllPlatformPosts } from '../src/integrations/social-distribution'

const router = Router()

router.post('/posts', async (req, res) => {
  const { streamId } = req.body as { streamId?: string }

  if (!streamId) {
    res.status(400).json({ error: 'streamId required' })
    return
  }

  const stream = await prisma.stream.findUnique({
    where:   { id: streamId },
    include: { creator: true },
  }).catch(() => null)

  if (!stream || !stream.creator) {
    res.status(404).json({ error: 'Stream not found' })
    return
  }

  const posts = buildAllPlatformPosts({
    id:          stream.id,
    title:       stream.title,
    creatorName: stream.creator.displayName || stream.creator.handle,
    handle:      stream.creator.handle,
    isLive:      stream.status === 'LIVE',
    viewerCount: (stream as any).viewerCount || 0,
    tipEnabled:  (stream as any).tipsEnabled ?? true,
    lumaEventId: (stream as any).lumaEventId ?? null,
  })

  res.json({ streamId, posts })
})

router.get('/status/:streamId', async (req, res) => {
  const { streamId } = req.params

  // Return fanout_events from DB if the table exists, else return empty array
  let events: unknown[] = []
  try {
    events = await (prisma as any).fanoutEvent.findMany({
      where:   { streamId },
      orderBy: { createdAt: 'desc' },
      take:    50,
    })
  } catch {
    // table may not exist yet
  }

  res.json({ streamId, events })
})

export default router
