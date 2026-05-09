import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// List user's webhook endpoints
export async function GET(req: NextRequest) {
  const supabase = await createServiceClient()
  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('id, url, events, created_at')
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Register a new webhook endpoint
export async function POST(req: NextRequest) {
  const supabase = await createServiceClient()
  const body = await req.json()
  const { user_id, url, events } = body

  if (!user_id || !url || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'user_id, url, and events[] required' }, { status: 400 })
  }

  try { new URL(url) } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const secret = crypto.randomBytes(24).toString('hex')

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({ user_id, url, events, secret })
    .select('id, url, events, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ...data, secret }, { status: 201 })
}

// Delete a webhook endpoint
export async function DELETE(req: NextRequest) {
  const supabase = await createServiceClient()
  const id = req.nextUrl.searchParams.get('id')
  const userId = req.nextUrl.searchParams.get('user_id')
  if (!id || !userId) return NextResponse.json({ error: 'id and user_id required' }, { status: 400 })

  const { error } = await supabase
    .from('webhook_endpoints')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
