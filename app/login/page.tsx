'use client'
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-white font-black text-xl" style={{fontFamily:'Plus Jakarta Sans'}}>p</span>
          </div>
          <span className="text-3xl font-black text-[#0f172a]" style={{fontFamily:'Plus Jakarta Sans'}}>
            praxis<span className="text-[#2563eb]">AI</span>
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">ברוכים הבאים</h1>
          <p className="text-[#475569] text-sm mb-8">פלטפורמת AI לקליניקות פיזיותרפיה בישראל</p>

          <button
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-[#e2e8f0] rounded-xl px-6 py-3.5 text-[#0f172a] font-semibold text-sm hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'מתחבר…' : 'כניסה עם Google'}
          </button>

          <div className="mt-6 pt-6 border-t border-[#f1f5f9]">
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              בכניסה לפלטפורמה אתה מסכים ל
              <a href="#" className="text-[#2563eb] hover:underline mx-1">תנאי השימוש</a>
              ול<a href="#" className="text-[#2563eb] hover:underline mx-1">מדיניות הפרטיות</a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-[#94a3b8] mt-6">
          🔒 נתוני המטופלים מוצפנים ומאוחסנים בתשתית EU בלבד
        </p>
      </div>
    </div>
  )
}
