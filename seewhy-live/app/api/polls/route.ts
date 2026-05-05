import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createServiceClient()
  const streamId = req.nextUrl.searchParams.get('stream_id')
  if (!streamId) return NextResponse.json({ error: 'stream_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('polls')
    .select('*, poll_options(id, text, votes)')
    .eq('stream_id', streamId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()
  const body = await req.json()
  const { stream_id, question, options } = body

  if (!stream_id || !question || !Array.isArray(options) || options.length < 2) {
    return NextResponse.json({ error: 'stream_id, question, and at least 2 options required' }, { status: 400 })
  }

  const { data: poll, error: pollErr } = await supabase
    .from('polls')
    .insert({ stream_id, question, status: 'active' })
    .select()
    .single()

  if (pollErr) return NextResponse.json({ error: pollErr.message }, { status: 500 })

  const optRows = options.map((text: string) => ({ poll_id: poll.id, text, votes: 0 }))
  const { error: optErr } = await supabase.from('poll_options').insert(optRows)
  if (optErr) return NextResponse.json({ error: optErr.message }, { status: 500 })

  return NextResponse.json(poll, { status: 201 })
}
