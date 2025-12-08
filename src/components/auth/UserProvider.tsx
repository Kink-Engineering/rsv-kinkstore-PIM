'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useUser } from '@/hooks/useUser'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type AppUser = Database['public']['Tables']['users']['Row']

interface UserContextType {
  user: User | null
  appUser: AppUser | null
  isLoading: boolean
  error: Error | null
  signOut: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const userState = useUser()

  return (
    <UserContext.Provider value={userState}>
      {children}
    </UserContext.Provider>
  )
}

export function useUserContext() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUserContext must be used within a UserProvider')
  }
  return context
}

