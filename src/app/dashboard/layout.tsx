import { createUntypedClient } from '@/lib/supabase/server-untyped'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import type { Database } from '@/lib/database.types'

type AppUser = Database['public']['Tables']['users']['Row']

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createUntypedClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()
  
  const appUser = data as AppUser | null

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar userRole={appUser?.role || 'viewer'} />
      <div className="flex-1 flex flex-col">
        <Header user={user} appUser={appUser} />
        <main className="flex-1 p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

