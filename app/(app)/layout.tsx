export const dynamic = 'force-dynamic'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen" dir="rtl">
      <Sidebar user={user} />
      <main className="ms-[248px] flex-1 p-8 max-w-[1280px]">
        {children}
      </main>
    </div>
  )
}
