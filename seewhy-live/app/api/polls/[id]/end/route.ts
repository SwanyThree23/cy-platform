import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServiceClient()
  const pollId = params.id

  // Mark poll ended
  const { data: poll, error: endErr } = await supabase
    .from('polls')
    .update({ status: 'ended' })
    .eq('id', pollId)
    .select('*, poll_options(id, text, votes)')
    .single()

  if (endErr || !poll) return NextResponse.json({ error: endErr?.message || 'Not found' }, { status: 500 })

  // Build results summary text
  const options = (poll.poll_options || []) as { id: string; text: string; votes: number }[]
  const total = options.reduce((s: number, o: { votes: number }) => s + o.votes, 0)
  const sorted = [...options].sort((a, b) => b.votes - a.votes)
  const winner = sorted[0]

  const resultLines = sorted
    .map((o: { text: string; votes: number }) => `• ${o.text}: ${o.votes} votes (${total ? Math.round((o.votes / total) * 100) : 0}%)`)
    .join('\n')

  const summary = `📊 Poll Results — "${poll.question}"\n\n${resultLines}\n\nTotal votes: ${total}${winner ? `\n🏆 Winner: ${winner.text}` : ''}`

  // Auto-post to activity feed
  await supabase.from('activity_feed').insert({
    stream_id: poll.stream_id,
    type: 'poll_results',
    content: summary,
    metadata: { poll_id: pollId, total_votes: total, winner: winner?.text },
  })

  return NextResponse.json({ ok: true, summary })
}
