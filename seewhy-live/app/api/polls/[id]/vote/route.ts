import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServiceClient()
  const body = await req.json()
  const { option_id, user_id } = body
  const pollId = params.id

  if (!option_id || !user_id) {
    return NextResponse.json({ error: 'option_id and user_id required' }, { status: 400 })
  }

  // Verify poll is still active
  const { data: poll } = await supabase
    .from('polls')
    .select('status')
    .eq('id', pollId)
    .single()

  if (!poll || poll.status !== 'active') {
    return NextResponse.json({ error: 'Poll is not active' }, { status: 400 })
  }

  // Prevent double-voting
  const { data: existing } = await supabase
    .from('poll_votes')
    .select('id')
    .eq('poll_id', pollId)
    .eq('user_id', user_id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already voted' }, { status: 409 })
  }

  // Record vote
  const { error: voteErr } = await supabase.from('poll_votes').insert({ poll_id: pollId, option_id, user_id })
  if (voteErr) return NextResponse.json({ error: voteErr.message }, { status: 500 })

  // Increment option vote count
  await supabase.rpc('increment_poll_option_votes', { p_option_id: option_id })

  return NextResponse.json({ ok: true })
}
