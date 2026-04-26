import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: ['Watch public streams', 'Basic chat', '480p quality'],
  },
  supporter: {
    name: 'Supporter',
    price: 499,
    priceId: process.env.STRIPE_SUPPORTER_PRICE_ID,
    features: ['HD streaming (1080p)', 'Ad-free viewing', 'Exclusive badges', 'Priority chat'],
  },
  creator: {
    name: 'Creator Pro',
    price: 1499,
    priceId: process.env.STRIPE_CREATOR_PRICE_ID,
    features: [
      'Go live instantly',
      'Multi-platform RTMP fan-out',
      'Up to 20 guests (Gold Board)',
      'Analytics dashboard',
      'Revenue share tools',
    ],
  },
} as const
