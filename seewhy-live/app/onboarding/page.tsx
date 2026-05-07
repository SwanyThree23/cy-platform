'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ArrowRight, Camera, DollarSign, Radio } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const STEPS = ['profile', 'payments', 'ready'] as const
type Step = typeof STEPS[number]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep]       = useState<Step>('profile')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Profile step
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername]       = useState('')
  const [bio, setBio]                 = useState('')

  // Payments step
  const [cashapp, setCashapp] = useState('')
  const [paypal,  setPaypal]  = useState('')
  const [venmo,   setVenmo]   = useState('')
  const [zelle,   setZelle]   = useState('')
  const [chime,   setChime]   = useState('')

  const stepIdx = STEPS.indexOf(step)

  async function saveProfile() {
    if (!displayName.trim() || !username.trim()) {
      setError('Display name and username are required.')
      return
    }
    setError(null)
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); router.push('/login'); return }

    const { error: err } = await supabase.from('profiles').upsert({
      id:           user.id,
      display_name: displayName.trim(),
      username:     username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      bio:          bio.trim() || null,
    })

    setSaving(false)
    if (err) { setError(err.message); return }
    setStep('payments')
  }

  async function savePayments() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({
        cashapp_handle: cashapp.trim() || null,
        paypal_handle:  paypal.trim()  || null,
        venmo_handle:   venmo.trim()   || null,
        zelle_handle:   zelle.trim()   || null,
        chime_handle:   chime.trim()   || null,
      }).eq('id', user.id)
    }
    setSaving(false)
    setStep('ready')
  }

  function goToDashboard() {
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-brand-bg">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                i < stepIdx  ? 'bg-gold border-gold text-black' :
                i === stepIdx ? 'bg-transparent border-gold text-gold' :
                'bg-transparent border-white/20 text-gray-600'
              }`}>
                {i < stepIdx ? <Check size={13} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 rounded-full transition-all ${i < stepIdx ? 'bg-gold' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step: Profile */}
        {step === 'profile' && (
          <div className="glass rounded-2xl border border-white/10 p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gold/15"><Camera size={22} className="text-gold" /></div>
              <div>
                <h1 className="text-xl font-black text-white">Set up your profile</h1>
                <p className="text-gray-400 text-sm">How you appear to viewers</p>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Display Name *</label>
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Joyce 🦋"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-gold/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Username *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="dominoentertainment"
                    className="w-full pl-8 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-gold/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Bio <span className="text-gray-600 normal-case">(optional)</span></label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell your audience about yourself…"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-gold/50 resize-none"
                />
              </div>
            </div>

            <button
              onClick={saveProfile}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-black font-bold text-sm disabled:opacity-50 transition-all hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
            >
              {saving ? 'Saving…' : <><ArrowRight size={16} /> Continue</>}
            </button>
          </div>
        )}

        {/* Step: Payments */}
        {step === 'payments' && (
          <div className="glass rounded-2xl border border-white/10 p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gold/15"><DollarSign size={22} className="text-gold" /></div>
              <div>
                <h1 className="text-xl font-black text-white">Add tip links</h1>
                <p className="text-gray-400 text-sm">100% of tips go directly to you — skip any you don't use</p>
              </div>
            </div>

            <div className="space-y-3">
              {([
                { label: 'Cash App',  value: cashapp, set: setCashapp, placeholder: '$yourcashtag' },
                { label: 'PayPal',    value: paypal,  set: setPaypal,  placeholder: 'paypal.me/you' },
                { label: 'Venmo',     value: venmo,   set: setVenmo,   placeholder: '@yourvenmo' },
                { label: 'Zelle',     value: zelle,   set: setZelle,   placeholder: 'phone or email' },
                { label: 'Chime',     value: chime,   set: setChime,   placeholder: '$chimepay tag' },
              ] as const).map(({ label, value, set, placeholder }) => (
                <div key={label} className="flex gap-2 items-center">
                  <span className="text-xs text-gray-400 w-20 shrink-0">{label}</span>
                  <input
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-gold/50"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('ready')}
                className="flex-1 py-3 rounded-xl text-gray-400 hover:text-white border border-white/10 text-sm transition-colors"
              >
                Skip for now
              </button>
              <button
                onClick={savePayments}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-black font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
              >
                {saving ? 'Saving…' : <><ArrowRight size={16} /> Continue</>}
              </button>
            </div>
          </div>
        )}

        {/* Step: Ready */}
        {step === 'ready' && (
          <div className="glass rounded-2xl border border-gold/25 p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-gold/15 border-2 border-gold flex items-center justify-center mx-auto">
              <Radio size={28} className="text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white mb-2">You're all set! 🎉</h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your profile is live. Head to your dashboard to go live, browse existing streams, or invite guests.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-left">
              {[
                { icon: '🔴', text: 'Go live in 30 seconds with OBS or evmux' },
                { icon: '👥', text: 'Invite up to 20 guests via VDO.Ninja' },
                { icon: '💸', text: 'Receive direct tips — 0% platform cut' },
                { icon: '📊', text: 'Real-time polls, chat moderation & analytics' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-2 text-sm text-gray-300">
                  <span>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <button
              onClick={goToDashboard}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-black font-bold"
              style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
            >
              <ArrowRight size={16} /> Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
