'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard', label: 'לוח בקרה', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg> },
  { href: '/patients', label: 'מטופלים', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { href: '/scribe', label: 'תיעוד AI', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg> },
  { href: '/chat', label: "צ'אט AI", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> },
  { href: '/documents', label: 'מסמכים', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
]

const NAV_BOTTOM = [
  { href: '/pricing', label: 'תמחור', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { href: '/settings', label: 'הגדרות', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
]

interface SidebarProps {
  user: { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'משתמש'
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-[248px] bg-[#0f1923] text-slate-400 fixed inset-y-0 end-0 flex flex-col z-50">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-white/[0.07]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center shadow-lg shadow-blue-500/40 shrink-0">
          <span className="text-white font-black text-base" style={{fontFamily:'Plus Jakarta Sans'}}>p</span>
        </div>
        <span className="text-white font-black text-lg tracking-tight" style={{fontFamily:'Plus Jakarta Sans'}}>
          praxis<span className="text-[#60a5fa]">AI</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <a key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-sm font-medium transition-all ${
                active ? 'bg-[#2563eb]/16 text-white font-semibold' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
              }`}>
              <span className={`w-5 h-5 shrink-0 ${active ? 'text-[#60a5fa]' : ''}`}>{item.icon}</span>
              {item.label}
            </a>
          )
        })}

        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest px-3.5 pt-5 pb-1.5">ניהול</div>

        {NAV_BOTTOM.map(item => {
          const active = pathname === item.href
          return (
            <a key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-sm font-medium transition-all ${
                active ? 'bg-[#2563eb]/16 text-white font-semibold' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
              }`}>
              <span className={`w-5 h-5 shrink-0 ${active ? 'text-[#60a5fa]' : ''}`}>{item.icon}</span>
              {item.label}
            </a>
          )
        })}
      </nav>

      {/* Trial chip */}
      <div className="mx-3 mb-3 text-center text-xs text-[#60a5fa] bg-[#2563eb]/12 border border-[#2563eb]/30 rounded-full py-1.5 font-semibold">
        תקופת ניסיון · 14 ימים
      </div>

      {/* User */}
      <div className="mx-3 mb-4 p-3 rounded-xl bg-white/[0.05] flex items-center gap-2.5">
        {user?.user_metadata?.avatar_url ? (
          <img src={user.user_metadata.avatar_url} className="w-8 h-8 rounded-full shrink-0" alt="" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-[#2563eb] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-semibold truncate">{name}</p>
          <p className="text-slate-500 text-[11px] truncate">{user?.email}</p>
        </div>
        <button onClick={signOut} title="התנתק" className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}
