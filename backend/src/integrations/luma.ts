/**
 * Luma (lu.ma) event lifecycle integration.
 * Requires LUMA_API_KEY env var (Luma Plus subscription).
 * All operations silently skip when the key is absent.
 */

const LUMA_BASE = 'https://public-api.lu.ma/v1'

function lumaHeaders(): Record<string, string> {
  return {
    'Content-Type':  'application/json',
    'x-luma-api-key': process.env.LUMA_API_KEY || '',
  }
}

function skip(): boolean {
  return !process.env.LUMA_API_KEY
}

export interface LumaEventParams {
  id:            string
  title:         string
  description?:  string
  scheduledAt:   Date
  thumbnailUrl?: string
  creatorName:   string
}

export interface LumaEvent {
  api_id:  string
  url:     string
  name:    string
  start_at: string
}

export async function createLumaEvent(params: LumaEventParams): Promise<LumaEvent | null> {
  if (skip()) return null
  try {
    const res = await fetch(`${LUMA_BASE}/event/create`, {
      method:  'POST',
      headers: lumaHeaders(),
      body:    JSON.stringify({
        name:        params.title,
        description: params.description ?? `Hosted by ${params.creatorName} on SeeWhy LIVE`,
        start_at:    params.scheduledAt.toISOString(),
        timezone:    'America/Los_Angeles',
        cover_image_url: params.thumbnailUrl,
        geo_address_visibility: 'none',
        meeting_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://seewhylive.online'}/watch/${params.id}`,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.warn(`[Luma] createEvent failed: ${res.status} ${await res.text()}`)
      return null
    }
    const data = await res.json() as { event: LumaEvent }
    console.log(`[Luma] Event created: ${data.event?.api_id}`)
    return data.event ?? null
  } catch (err) {
    console.warn('[Luma] createEvent error:', err)
    return null
  }
}

export async function updateLumaEventOnGoLive(
  lumaEventId: string,
  stream: { id: string; title: string }
): Promise<void> {
  if (skip()) return
  const watchUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://seewhylive.online'}/watch/${stream.id}`
  try {
    const res = await fetch(`${LUMA_BASE}/event/edit`, {
      method:  'POST',
      headers: lumaHeaders(),
      body:    JSON.stringify({
        api_id:      lumaEventId,
        meeting_url: watchUrl,
        description: `🔴 LIVE NOW — Watch at ${watchUrl}`,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.warn(`[Luma] updateOnGoLive failed: ${res.status}`)
    else console.log(`[Luma] Event ${lumaEventId} updated → LIVE`)
  } catch (err) {
    console.warn('[Luma] updateOnGoLive error:', err)
  }
}

export async function updateLumaEventOnEnd(
  lumaEventId: string,
  stream: { id: string; title: string }
): Promise<void> {
  if (skip()) return
  const replayUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://seewhylive.online'}/watch/${stream.id}`
  try {
    const res = await fetch(`${LUMA_BASE}/event/edit`, {
      method:  'POST',
      headers: lumaHeaders(),
      body:    JSON.stringify({
        api_id:      lumaEventId,
        description: `⏹️ Stream ended. Watch the replay at ${replayUrl}`,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.warn(`[Luma] updateOnEnd failed: ${res.status}`)
    else console.log(`[Luma] Event ${lumaEventId} updated → ENDED`)
  } catch (err) {
    console.warn('[Luma] updateOnEnd error:', err)
  }
}
