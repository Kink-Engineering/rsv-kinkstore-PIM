import { createUntypedClient } from '@/lib/supabase/server-untyped'
import { importAllProducts } from '@/lib/shopify/import'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Check auth
    const supabase = await createUntypedClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check user role - only admins can import
    const { data: appUser } = await supabase
      .from('users')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (appUser?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Run import
    const result = await importAllProducts(supabase)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { 
        error: 'Import failed', 
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Return import status / last sync info
  try {
    const supabase = await createUntypedClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get last sync log
    const { data: lastSync } = await supabase
      .from('sync_logs')
      .select('*')
      .eq('sync_type', 'import_from_shopify')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Get product count
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      lastSync,
      productCount,
    })
  } catch (error) {
    console.error('Status error:', error)
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    )
  }
}

