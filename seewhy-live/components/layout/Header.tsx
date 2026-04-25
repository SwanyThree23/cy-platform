'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Radio, LayoutGrid, User, LogOut, ChevronDown } from 'lucide-react'
import type { User as SupaUser } from '@supabase/supabase-js'

export function Header() {
  const [user, setUser]           = useState<SupaUser | null>(null)
  const [menuOpen, setMenuOpen]   = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-black text-xl" style={{ color: 'var(--gold)' }}>
          <Radio size={22} />
          SeeWhy Live
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/streams" className="text-gray-300 hover:text-white transition-colors flex items-center gap-1.5">
            <LayoutGrid size={15} />
            Browse
          </Link>
        </nav>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm"
              >
                <User size={15} className="text-yellow-400" />
                <span className="hidden sm:block text-gray-200">{user.email?.split('@')[0]}</span>
                <ChevronDown size={13} className="text-gray-400" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 w-44 glass rounded-xl py-1.5 shadow-xl border border-white/10">
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-200 hover:text-white hover:bg-white/5"
                  >
                    <LayoutGrid size={14} /> Dashboard
                  </Link>
                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-white/5"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors">
                Sign In
              </Link>
              <Link
                href="/login"
                className="px-4 py-1.5 rounded-lg text-sm font-bold text-black transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)' }}
              >
                Go Live
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
