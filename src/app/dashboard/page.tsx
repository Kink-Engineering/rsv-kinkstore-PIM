import { createUntypedClient } from '@/lib/supabase/server-untyped'
import { redirect } from 'next/navigation'
import type { Database } from '@/lib/database.types'

type AppUser = Database['public']['Tables']['users']['Row']

export default async function DashboardPage() {
  const supabase = await createUntypedClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Get app user data
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()
  
  const appUser = data as AppUser | null

  // Get some stats
  const [
    { count: productCount },
    { count: mediaCount },
  ] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('media_assets').select('*', { count: 'exact', head: true }),
  ])

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl p-8 border border-amber-500/20">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome back, {appUser?.name || user.email?.split('@')[0]}!
        </h1>
        <p className="text-slate-400">
          Role: <span className="text-amber-400 font-medium capitalize">{appUser?.role || 'viewer'}</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Products"
          value={productCount || 0}
          icon="📦"
          href="/products"
        />
        <StatCard
          title="Media Assets"
          value={mediaCount || 0}
          icon="🖼️"
          href="/media"
        />
        <StatCard
          title="Pending Publish"
          value={0}
          icon="📤"
          href="/products?status=ready"
        />
        <StatCard
          title="Sync Status"
          value="OK"
          icon="✓"
          href="/sync"
          valueColor="text-green-400"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            title="Import from Shopify"
            description="Sync products from your Shopify store"
            icon="🛍️"
            href="/import/shopify"
          />
          <QuickAction
            title="Upload Media"
            description="Add new images or videos"
            icon="⬆️"
            href="/media/upload"
          />
          <QuickAction
            title="View Products"
            description="Browse and edit product catalog"
            icon="📋"
            href="/products"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ 
  title, 
  value, 
  icon, 
  href,
  valueColor = 'text-white'
}: { 
  title: string
  value: number | string
  icon: string
  href: string
  valueColor?: string
}) {
  return (
    <a 
      href={href}
      className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-amber-500/30 transition-all duration-200 group"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl">{icon}</span>
        <span className="text-slate-500 group-hover:text-amber-400 transition-colors">→</span>
      </div>
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-slate-400 text-sm mt-1">{title}</p>
    </a>
  )
}

function QuickAction({
  title,
  description,
  icon,
  href,
}: {
  title: string
  description: string
  icon: string
  href: string
}) {
  return (
    <a
      href={href}
      className="flex items-start gap-4 p-4 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/30 hover:border-amber-500/30 transition-all duration-200"
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <h3 className="font-medium text-white">{title}</h3>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </a>
  )
}

