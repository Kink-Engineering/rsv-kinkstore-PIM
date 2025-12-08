'use client'

import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import type { Database } from '@/lib/database.types'

type AppUser = Database['public']['Tables']['users']['Row']

interface UseUserReturn {
  user: User | null
  appUser: AppUser | null
  isLoading: boolean
  error: Error | null
  signOut: () => Promise<void>
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Get initial session
    const getUser = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError) {
          throw authError
        }

        setUser(user)

        if (user) {
          // Fetch app user data
          const { data: appUserData, error: appUserError } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', user.id)
            .single()

          if (appUserError && appUserError.code !== 'PGRST116') {
            // PGRST116 = no rows returned, which is fine for new users
            throw appUserError
          }

          setAppUser(appUserData)
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        
        if (session?.user) {
          const { data: appUserData } = await supabase
            .from('users')
            .select('*')
            .eq('auth_user_id', session.user.id)
            .single()
          
          setAppUser(appUserData)
        } else {
          setAppUser(null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setAppUser(null)
  }

  return { user, appUser, isLoading, error, signOut }
}

