import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'

const LIVEKIT_URL   = process.env.NEXT_PUBLIC_LIVEKIT_URL!
const LIVEKIT_API   = process.env.LIVEKIT_API_KEY!
const LIVEKIT_SECRET = process.env.LIVEKIT_API_SECRET!

export async function createViewerToken(room: string, identity: string) {
  const at = new AccessToken(LIVEKIT_API, LIVEKIT_SECRET, {
    identity,
    ttl: '2h',
  })
  at.addGrant({ roomJoin: true, room, canPublish: false, canSubscribe: true })
  return at.toJwt()
}

export async function createHostToken(room: string, identity: string) {
  const at = new AccessToken(LIVEKIT_API, LIVEKIT_SECRET, {
    identity,
    ttl: '4h',
  })
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    roomCreate: true,
    roomAdmin: true,
  })
  return at.toJwt()
}

export function getRoomService() {
  return new RoomServiceClient(
    LIVEKIT_URL.replace('wss://', 'https://').replace('ws://', 'http://'),
    LIVEKIT_API,
    LIVEKIT_SECRET,
  )
}
