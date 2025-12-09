import { createUntypedClient } from '@/lib/supabase/server-untyped'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createUntypedClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      product_id,
      shopify_variant_id = null,
      title = null,
      sku = null,
      price = null,
      compare_at_price = null,
      weight = null,
      weight_unit = null,
      inventory_quantity = null,
      position = null,
      option1 = null,
      option2 = null,
      option3 = null,
    } = body || {}

    if (!product_id || typeof product_id !== 'string') {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('product_variants')
      .insert({
        product_id,
        shopify_variant_id,
        title,
        sku,
        price,
        compare_at_price,
        weight,
        weight_unit,
        inventory_quantity,
        position,
        option1,
        option2,
        option3,
      })
      .select(
        `
        id,
        product_id,
        shopify_variant_id,
        title,
        sku,
        price,
        compare_at_price,
        weight,
        weight_unit,
        inventory_quantity,
        position,
        option1,
        option2,
        option3,
        created_at,
        updated_at
      `
      )
      .single()

    if (error) {
      console.error('Variant create error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ variant: data }, { status: 201 })
  } catch (error) {
    console.error('Variant create API error:', error)
    return NextResponse.json(
      { error: 'Failed to create variant' },
      { status: 500 }
    )
  }
}

