'use client'
import { motion } from 'framer-motion'
import { X, ExternalLink } from 'lucide-react'
import type { Profile } from '@/types'

interface Props {
  host: Profile
  onClose: () => void
}

const PAYMENT_METHODS = [
  { id: 'cashapp',  label: 'Cash App',   emoji: '💚', color: '#00c853', urlFn: (h: string) => `https://cash.app/$${h}` },
  { id: 'paypal',   label: 'PayPal',     emoji: '💙', color: '#003087', urlFn: (h: string) => `https://paypal.me/${h}` },
  { id: 'venmo',    label: 'Venmo',      emoji: '💜', color: '#3d95ce', urlFn: (h: string) => `https://venmo.com/${h}` },
  { id: 'zelle',    label: 'Zelle',      emoji: '💛', color: '#6d1ed4', urlFn: (h: string) => `tel:${h}` },
  { id: 'chime',    label: 'Chime',      emoji: '🟢', color: '#42c473', urlFn: (h: string) => `https://chime.com/${h}` },
] as const

export function TipSheet({ host, onClose }: Props) {
  const handles: Record<string, string | null> = {
    cashapp: host.cashapp_handle,
    paypal:  host.paypal_handle,
    venmo:   host.venmo_handle,
    zelle:   host.zelle_handle,
    chime:   null,
  }

  const available = PAYMENT_METHODS.filter(m => handles[m.id])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm mx-4 rounded-3xl bg-brand-card border border-white/10 overflow-hidden"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h3 className="text-white font-bold text-lg">Tip {host.display_name}</h3>
            <p className="text-gray-400 text-sm">100% goes directly to the creator</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {available.length === 0 ? (
            <p className="text-gray-500 text-center py-6">Creator hasn't set up payment methods yet</p>
          ) : (
            available.map(method => {
              const handle = handles[method.id]!
              return (
                <a
                  key={method.id}
                  href={method.urlFn(handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-all active:scale-95"
                  style={{ background: `${method.color}15` }}
                >
                  <span className="text-3xl">{method.emoji}</span>
                  <div className="flex-1">
                    <p className="text-white font-semibold">{method.label}</p>
                    <p className="text-gray-400 text-sm">{handle}</p>
                  </div>
                  <ExternalLink size={16} className="text-gray-400" />
                </a>
              )
            })
          )}
        </div>

        <div className="px-5 pb-5">
          <p className="text-center text-xs text-gray-600">
            No platform fees. No middlemen. Direct support.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
