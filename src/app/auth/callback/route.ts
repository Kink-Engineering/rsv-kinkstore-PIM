import { createUntypedClient } from '@/lib/supabase/server-untyped'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createUntypedClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Check if user exists in our users table, if not create them
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .single()

        if (!existingUser) {
          // Create new user with default 'viewer' role
          await supabase.from('users').insert({
            auth_user_id: user.id,
            email: user.email!,
            name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            role: 'viewer',
          })
        } else {
          // Update last login
          await supabase
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('auth_user_id', user.id)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}

