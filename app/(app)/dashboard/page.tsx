export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const name = user?.user_metadata?.full_name?.split(' ')[0] || 'שם'

  const stats = [
    { label: 'טיפולים היום', value: '8', delta: '3 הושלמו · 5 מתוכננים', color: 'blue' },
    { label: 'סיכומים לחתימה', value: '3', delta: 'ממתינים לאישורך', color: 'amber' },
    { label: 'מטופלים פעילים', value: '47', delta: '+4 החודש', color: 'green' },
    { label: 'שיפור VAS ממוצע', value: '−2.8', delta: 'ירידה בכאב לאורך טיפול', color: 'violet' },
  ]

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">בוקר טוב, {name} 👋</h1>
          <p className="text-[#475569] text-sm mt-1">
            {new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <a href="/scribe" className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold px-4 py-2.5 rounded-[10px] shadow-md shadow-blue-500/25 transition-all hover:-translate-y-px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
          התחל תיעוד טיפול
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-5">
            <p className="text-sm text-[#475569] font-medium">{s.label}</p>
            <p className="text-3xl font-extrabold tracking-tight mt-1.5" style={{fontFamily:'Plus Jakarta Sans'}}>{s.value}</p>
            <p className={`text-xs font-semibold mt-1.5 inline-block px-2 py-0.5 rounded-full ${colorMap[s.color]}`}>{s.delta}</p>
          </div>
        ))}
      </div>

      {/* Schedule + Alerts */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-4">
        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-5">
          <h3 className="font-bold text-base mb-4 flex items-center justify-between">
            לוח הזמנים של היום
            <span className="text-xs font-semibold bg-blue-50 text-blue-600 rounded-full px-3 py-1">8 פגישות</span>
          </h3>
          {[
            { time: '08:00', name: 'יוסי לוי', sub: 'מעקב · כאב גב תחתון', badge: 'הושלם', cls: 'bg-emerald-50 text-emerald-700' },
            { time: '09:00', name: 'מירה אברהם', sub: 'הערכה ראשונית · כתף קפואה', badge: 'הושלם', cls: 'bg-emerald-50 text-emerald-700' },
            { time: '10:00', name: 'אבי מזרחי', sub: 'שיקום ACL · ביטוח לאומי', badge: 'הושלם', cls: 'bg-emerald-50 text-emerald-700' },
            { time: '11:30', name: 'רונית שפירא', sub: 'מעקב · צוואר', badge: 'בעוד 40 דק\'', cls: 'bg-amber-50 text-amber-700' },
            { time: '13:00', name: 'דוד פרץ', sub: 'הערכה ראשונית', badge: 'מתוכנן', cls: 'bg-blue-50 text-blue-700' },
          ].map(a => (
            <div key={a.time} className="flex items-center gap-3 py-3 border-b border-[#f1f5f9] last:border-none">
              <span className="text-xs font-bold text-[#2563eb] bg-[#eff6ff] rounded-lg px-2.5 py-1.5 shrink-0 tabular-nums" dir="ltr">{a.time}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{a.name}</p>
                <p className="text-[#94a3b8] text-xs">{a.sub}</p>
              </div>
              <span className={`text-xs font-semibold rounded-full px-2.5 py-1 shrink-0 ${a.cls}`}>{a.badge}</span>
            </div>
          ))}
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-5">
          <h3 className="font-bold text-base mb-4">דורש תשומת לב</h3>
          {[
            { icon: '📝', title: '3 סיכומים בטיוטה', sub: 'ממתינים לחתימה דיגיטלית', href: '/scribe' },
            { icon: '💬', title: 'שאלה ממטופל', sub: 'יוסי לוי — הוסבה מהצ\'אט', href: '/chat' },
            { icon: '📄', title: 'מכתב ביטוח לאומי', sub: 'אבי מזרחי — מוכן ליצירה', href: '/documents' },
          ].map(a => (
            <a key={a.title} href={a.href} className="flex items-center gap-3 py-3 border-b border-[#f1f5f9] last:border-none hover:bg-[#f8fafc] rounded-xl px-2 -mx-2 transition-colors">
              <span className="text-xl shrink-0">{a.icon}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{a.title}</p>
                <p className="text-[#94a3b8] text-xs">{a.sub}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
