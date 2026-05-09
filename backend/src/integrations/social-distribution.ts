/**
 * Social distribution — builds formatted announcement posts for 7 platforms.
 * Platforms without public APIs receive content via n8n email digest.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://seewhylive.online'

export type PlatformKey =
  | 'chattersocial'
  | 'fanbase'
  | 'social_contact_network'
  | 'lfg_nexus'
  | 'social_expo'
  | 'gobrunch'
  | 'luma'

export interface PlatformPost {
  platform:     PlatformKey
  profileUrl:   string
  postText:     string
  hashtags:     string[]
  hasApi:       boolean
  manualSteps?: string
}

interface StreamInfo {
  id:          string
  title:       string
  creatorName: string
  handle:      string
  isLive:      boolean
  viewerCount: number
  tipEnabled:  boolean
  lumaEventId?: string | null
}

function watchUrl(streamId: string): string {
  return `${BASE_URL}/watch/${streamId}`
}

function buildChatterSocial(s: StreamInfo): PlatformPost {
  return {
    platform:  'chattersocial',
    profileUrl: `https://preview.chattersocial.io/user/${process.env.CHATTER_USER_ID || 'b6f01da5-329f-4233-96d4-f6b43859c0fc'}`,
    postText:  `🔴 We're LIVE on SeeWhy LIVE!\n\n"${s.title}" with ${s.creatorName}\n\n👉 ${watchUrl(s.id)}`,
    hashtags:  ['SeeWhyLive', 'DominoEntertainment', 'LiveNow'],
    hasApi:    false,
    manualSteps: 'Paste into ChatterSocial post composer',
  }
}

function buildFanbase(s: StreamInfo): PlatformPost {
  return {
    platform:  'fanbase',
    profileUrl: process.env.FANBASE_PROFILE_URL || 'https://www.fanbase.app/audio/dominoentertainment',
    postText:  `🎙️ ${s.creatorName} is LIVE!\n\n"${s.title}" — watch free at ${watchUrl(s.id)}\n\nDrop in and show love! 🙌`,
    hashtags:  ['Fanbase', 'SeeWhyLive', 'StreamingNow'],
    hasApi:    false,
    manualSteps: 'Post to Fanbase profile or audio room',
  }
}

function buildSocialContactNetwork(s: StreamInfo): PlatformPost {
  return {
    platform:  'social_contact_network',
    profileUrl: 'https://socialcontactnetwork.mn.co',
    postText:  `📡 Live stream alert!\n\n${s.creatorName} is streaming "${s.title}" right now.\nJoin us: ${watchUrl(s.id)}`,
    hashtags:  ['LiveStream', 'Community', 'DominoEntertainment'],
    hasApi:    false,
    manualSteps: 'Post to Social Contact Network community feed',
  }
}

function buildLfgNexus(s: StreamInfo): PlatformPost {
  return {
    platform:  'lfg_nexus',
    profileUrl: 'https://lfgnexus.com',
    postText:  `🎮 LFG! ${s.creatorName} is LIVE on SeeWhy LIVE\n"${s.title}"\nWatch: ${watchUrl(s.id)}`,
    hashtags:  ['LFG', 'LiveNow', 'SeeWhyLive'],
    hasApi:    false,
    manualSteps: 'Share in LFG Nexus relevant channels',
  }
}

function buildSocialExpo(s: StreamInfo): PlatformPost {
  return {
    platform:  'social_expo',
    profileUrl: 'https://socialexpo.exposim.io',
    postText:  `✨ Tune in LIVE!\n\n${s.creatorName} presents "${s.title}" on SeeWhy LIVE.\nWatch here: ${watchUrl(s.id)}`,
    hashtags:  ['SocialExpo', 'LiveStreaming', 'Creator'],
    hasApi:    false,
    manualSteps: 'Post to Social Expo profile',
  }
}

function buildGoBrunch(s: StreamInfo): PlatformPost {
  return {
    platform:  'gobrunch',
    profileUrl: 'https://gobrunch.com/eventsmain',
    postText:  `☕ Join us LIVE on SeeWhy!\n\n"${s.title}" — hosted by ${s.creatorName}\n▶️ ${watchUrl(s.id)}\n\nNo signup required!`,
    hashtags:  ['GoBrunch', 'LiveEvent', 'SeeWhyLive'],
    hasApi:    false,
    manualSteps: 'Create event in GoBrunch or share in community',
  }
}

function buildLuma(s: StreamInfo): PlatformPost {
  const lumaUrl = process.env.LUMA_CALENDAR_URL || 'https://lu.ma/7nq16vfg'
  return {
    platform:  'luma',
    profileUrl: lumaUrl,
    postText:  `📅 We're LIVE!\n\n"${s.title}" with ${s.creatorName}\nWatch: ${watchUrl(s.id)}${s.lumaEventId ? `\nLuma event: ${lumaUrl}` : ''}`,
    hashtags:  ['Luma', 'LiveNow', 'SeeWhyLive'],
    hasApi:    true,
    manualSteps: s.lumaEventId ? 'Auto-updated via Luma API' : 'No Luma event linked — schedule a stream with a date to auto-create',
  }
}

export function buildAllPlatformPosts(stream: StreamInfo): PlatformPost[] {
  return [
    buildChatterSocial(stream),
    buildFanbase(stream),
    buildSocialContactNetwork(stream),
    buildLfgNexus(stream),
    buildSocialExpo(stream),
    buildGoBrunch(stream),
    buildLuma(stream),
  ]
}

/** Fire-and-forget: call n8n webhook to distribute posts */
export async function triggerN8nDistribution(stream: StreamInfo): Promise<void> {
  const webhookUrl = process.env.N8N_SOCIAL_DISTRIBUTION_WEBHOOK
  if (!webhookUrl) return

  const posts = buildAllPlatformPosts(stream)
  const payload = {
    stream_id:   stream.id,
    title:       stream.title,
    creator:     stream.creatorName,
    handle:      stream.handle,
    watch_url:   watchUrl(stream.id),
    is_live:     stream.isLive,
    posts,
    secret:      process.env.N8N_INTERNAL_SECRET,
  }

  try {
    await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(10_000),
    })
    console.log('[SocialDist] n8n distribution triggered')
  } catch (err) {
    console.warn('[SocialDist] n8n trigger failed (non-fatal):', err)
  }
}

/** Fire-and-forget: call n8n ChatterSocial announcer webhook */
export async function triggerN8nChatterSocial(payload: {
  streamId: string; title: string; creatorName: string; handle: string;
  watchUrl: string; viewerCount: number; isLive: boolean
}): Promise<void> {
  const webhookUrl = process.env.N8N_CHATTERSOCIAL_WEBHOOK
  if (!webhookUrl) return
  try {
    await fetch(webhookUrl, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-n8n-secret': process.env.N8N_INTERNAL_SECRET || '',
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    })
    console.log('[ChatterSocial] n8n announcer triggered')
  } catch (err) {
    console.warn('[ChatterSocial] n8n trigger failed (non-fatal):', err)
  }
}
