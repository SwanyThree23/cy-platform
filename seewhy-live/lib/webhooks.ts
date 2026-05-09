import crypto from 'crypto'

export const WEBHOOK_EVENTS = {
  STREAM_LIVE: 'stream.live',
  STREAM_ENDED: 'stream.ended',
  VIEWER_MILESTONE: 'viewer.milestone',
  POLL_ENDED: 'poll.ended',
} as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS]

export interface WebhookEndpoint {
  id: string
  url: string
  secret: string
  events: WebhookEvent[]
  user_id: string
}

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
}

function sign(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

export async function dispatchWebhook(
  endpoints: WebhookEndpoint[],
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  }
  const body = JSON.stringify(payload)

  const eligible = endpoints.filter(ep => ep.events.includes(event))

  await Promise.allSettled(
    eligible.map(ep =>
      fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SeeWhy-Event': event,
          'X-SeeWhy-Signature': `sha256=${sign(ep.secret, body)}`,
        },
        body,
        signal: AbortSignal.timeout(8000),
      }).catch(() => null)
    )
  )
}
