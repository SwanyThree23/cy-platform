import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateRoomId } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl
  const status = searchParams.get('status') ?? 'live'

  const { data, error } = await supabase
    .from('streams')
    .select('*, host:profiles(*)')
    .eq('status', status)
    .order('viewer_count', { ascending: false })
    .limit(48)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, description, category } = body

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const livekitRoom = generateRoomId(title, user.id)

  const service = await createServiceClient()
  const { data: stream, error } = await service
    .from('streams')
    .insert({
      host_id: user.id,
      title,
      description,
      category: category ?? 'TALK',
      status: 'live',
      livekit_room: livekitRoom,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(stream, { status: 201 })
}
