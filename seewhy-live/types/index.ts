export type StreamStatus = 'scheduled' | 'live' | 'ended'
export type AccountTier  = 'free' | 'supporter' | 'creator'
export type GuestRole    = 'guest' | 'co-host'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  account_tier: AccountTier
  follower_count: number
  stripe_customer_id: string | null
  paypal_handle: string | null
  cashapp_handle: string | null
  venmo_handle: string | null
  created_at: string
}

export interface Stream {
  id: string
  host_id: string
  host: Profile
  title: string
  description: string | null
  thumbnail_url: string | null
  category: string
  status: StreamStatus
  viewer_count: number
  peak_viewers: number
  livekit_room: string
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  stream_id: string
  user_id: string
  username: string
  avatar_url: string | null
  content: string
  is_donation: boolean
  donation_amount: number | null
  created_at: string
}

export interface GuestSlot {
  position: number
  user_id: string | null
  username: string | null
  avatar_url: string | null
  role: GuestRole
  is_muted: boolean
  is_camera_off: boolean
}

export interface GoldBoardState {
  host: Profile | null
  guests: GuestSlot[]
}
