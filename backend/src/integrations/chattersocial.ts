/**
 * ChatterSocial integration — builds shareable announcement cards.
 * No public API exists; this formats content for clipboard + n8n email dispatch.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://seewhylive.online'
const CHATTER_USER_ID  = process.env.CHATTER_USER_ID  || 'b6f01da5-329f-4233-96d4-f6b43859c0fc'
const CHATTER_GROUP_ID = process.env.CHATTER_GROUP_ID || '8543432e-4b77-45c7-88a9-c608a5bb64d8'

export interface ChatterShareCard {
  streamId:        string
  title:           string
  creatorName:     string
  handle:          string
  watchUrl:        string
  viewerCount:     number
  isLive:          boolean
  tipEnabled:      boolean
  announcementText: string
  clipboardText:   string
  ogMeta: {
    url:         string
    title:       string
    description: string
    imageUrl:    string
    type:        string
    twitterCard: string
  }
  chatterDeepLink: string
  groupId:         string
  userId:          string
}

export function buildChatterShareCard(params: {
  streamId:    string
  title:       string
  creatorName: string
  handle:      string
  watchUrl:    string
  viewerCount: number
  isLive:      boolean
  tipEnabled:  boolean
}): ChatterShareCard {
  const { streamId, title, creatorName, handle, watchUrl, viewerCount, isLive, tipEnabled } = params

  const statusTag  = isLive ? '🔴 LIVE NOW' : '🎬 Starting Soon'
  const viewerLine = isLive && viewerCount > 0 ? `\n👥 ${viewerCount} watching` : ''
  const tipLine    = tipEnabled ? '\n💸 Tips enabled — direct to creator, 0% platform cut' : ''

  const announcementText = `${statusTag} — ${title}\n\n` +
    `🎙️ Hosted by ${creatorName} (@${handle})${viewerLine}${tipLine}\n\n` +
    `▶️ Watch: ${watchUrl}`

  const clipboardText = announcementText + `\n\n#SeeWhyLive #DominoEntertainment`

  return {
    streamId,
    title,
    creatorName,
    handle,
    watchUrl,
    viewerCount,
    isLive,
    tipEnabled,
    announcementText,
    clipboardText,
    ogMeta: {
      url:         watchUrl,
      title:       `${title} — ${isLive ? 'LIVE' : 'Starting Soon'}`,
      description: `${creatorName} is ${isLive ? 'live' : 'going live soon'} on SeeWhy LIVE`,
      imageUrl:    `${BASE_URL}/api/og/stream?streamId=${streamId}`,
      type:        'video.other',
      twitterCard: 'summary_large_image',
    },
    chatterDeepLink: `https://preview.chattersocial.io/user/${CHATTER_USER_ID}`,
    groupId: CHATTER_GROUP_ID,
    userId:  CHATTER_USER_ID,
  }
}
