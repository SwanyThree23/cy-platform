import { NextRequest, NextResponse } from 'next/server'
import { createViewerToken, createHostToken } from '@/lib/livekit'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const room     = searchParams.get('room')
  const identity = searchParams.get('identity')
  const asHost   = searchParams.get('host') === '1'

  if (!room || !identity) {
    return NextResponse.json({ error: 'Missing room or identity' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  try {
    const token = asHost && user
      ? await createHostToken(room, identity)
      : await createViewerToken(room, identity)

    return NextResponse.json({ token })
  } catch (err) {
    return NextResponse.json({ error: 'Token generation failed' }, { status: 500 })
  }
}
