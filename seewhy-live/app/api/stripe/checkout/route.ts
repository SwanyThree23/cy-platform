import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS } from '@/lib/stripe'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await req.json()
  const planConfig = PLANS[plan as keyof typeof PLANS]
  if (!planConfig || !planConfig.priceId) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const service = await createServiceClient()
  const { data: profile } = await service.from('profiles').select('stripe_customer_id').eq('id', user.id).single()

  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { supabase_uid: user.id } })
    customerId = customer.id
    await service.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: planConfig.priceId!, quantity: 1 }],
    success_url: `${origin}/dashboard?upgraded=1`,
    cancel_url: `${origin}/pricing`,
    metadata: { supabase_uid: user.id, plan },
  })

  return NextResponse.json({ url: session.url })
}
