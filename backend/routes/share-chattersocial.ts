/**
 * routes/share-chattersocial.ts
 * GET /api/share/chattersocial/:streamId  — returns formatted share card JSON
 * GET /api/share/chattersocial/:streamId/text — returns plain text for clipboard
 */

import { Router } from 'express'
import prisma from '../prisma'
import { buildChatterShareCard } from '../src/integrations/chattersocial'

const router = Router()

router.get('/:streamId', async (req, res) => {
  const { streamId } = req.params

  const stream = await prisma.stream.findUnique({
    where:   { id: streamId },
    include: { creator: true },
  }).catch(() => null)

  if (!stream || !stream.creator) {
    res.status(404).json({ error: 'Stream not found' })
    return
  }

  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://seewhylive.online'

  const card = buildChatterShareCard({
    streamId:    stream.id,
    title:       stream.title,
    creatorName: stream.creator.displayName || stream.creator.handle,
    handle:      stream.creator.handle,
    watchUrl:    `${BASE_URL}/watch/${stream.id}`,
    viewerCount: (stream as any).viewerCount || 0,
    isLive:      stream.status === 'LIVE',
    tipEnabled:  (stream as any).tipsEnabled ?? true,
  })

  res.json(card)
})

router.get('/:streamId/text', async (req, res) => {
  const { streamId } = req.params

  const stream = await prisma.stream.findUnique({
    where:   { id: streamId },
    include: { creator: true },
  }).catch(() => null)

  if (!stream || !stream.creator) {
    res.status(404).json({ error: 'Stream not found' })
    return
  }

  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://seewhylive.online'

  const card = buildChatterShareCard({
    streamId:    stream.id,
    title:       stream.title,
    creatorName: stream.creator.displayName || stream.creator.handle,
    handle:      stream.creator.handle,
    watchUrl:    `${BASE_URL}/watch/${stream.id}`,
    viewerCount: (stream as any).viewerCount || 0,
    isLive:      stream.status === 'LIVE',
    tipEnabled:  (stream as any).tipsEnabled ?? true,
  })

  res.type('text/plain').send(card.clipboardText)
})

export default router
