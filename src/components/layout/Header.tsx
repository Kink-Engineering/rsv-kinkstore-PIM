'use client'

import { User } from '@supabase/supabase-js'
import { useState, useRef, useEffect } from 'react'
import type { Database } from '@/lib/database.types'

type AppUser = Database['public']['Tables']['users']['Row']

interface HeaderProps {
  user: User
  appUser: AppUser | null
}

export function Header({ user, appUser }: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = appUser?.name || user.email?.split('@')[0] || 'User'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <header className="h-16 border-b border-slate-700/50 bg-slate-800/30 flex items-center justify-between px-8">
      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <input
            type="text"
            placeholder="Search products, media..."
            className="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-2 pl-10 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>
      </div>

      {/* User Menu */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-700/50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-sm font-medium">
            {initials}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-sm font-medium text-white">{displayName}</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
          <span className="text-slate-400 text-xs">▼</span>
        </button>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-xl border border-slate-700/50 shadow-xl overflow-hidden z-50">
            <div className="p-3 border-b border-slate-700/50">
              <p className="text-sm font-medium text-white">{displayName}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
              <p className="text-xs text-amber-400 mt-1 capitalize">
                {appUser?.role || 'viewer'}
              </p>
            </div>
            <div className="p-2">
              <a
                href="/settings"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <span>⚙️</span> Settings
              </a>
              <form action="/auth/logout" method="GET">
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <span>🚪</span> Sign out
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

