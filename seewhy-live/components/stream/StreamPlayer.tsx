'use client'
import '@livekit/components-styles'
import { LiveKitRoom, VideoConference } from '@livekit/components-react'

interface Props {
  token: string
  serverUrl: string
}

export function StreamPlayer({ token, serverUrl }: Props) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      video={false}
      audio={false}
      style={{ height: '100%', width: '100%', background: '#000' }}
    >
      <VideoConference />
    </LiveKitRoom>
  )
}
