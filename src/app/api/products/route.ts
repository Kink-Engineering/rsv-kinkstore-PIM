import { createUntypedClient } from '@/lib/supabase/server-untyped'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createUntypedClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const search = searchParams.get('search') || ''

    const offset = (page - 1) * pageSize

    // Build query
    let query = supabase
      .from('products')
      .select(`
        id,
        title,
        handle,
        sku_label,
        vendor,
        product_type,
        status,
        shopify_status,
        tags,
        last_synced_at,
        variants:product_variants(count)
      `, { count: 'exact' })
      .order('title', { ascending: true })
      .range(offset, offset + pageSize - 1)

    // Add search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,sku_label.ilike.%${search}%,handle.ilike.%${search}%`)
    }

    const { data: products, count, error } = await query

    if (error) {
      console.error('Products query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      products,
      total: count ?? 0,
      page,
      pageSize,
    })
  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

