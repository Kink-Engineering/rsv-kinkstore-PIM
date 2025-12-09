type ProductInput = {
  title?: string
  handle?: string | null
  sku_label?: string | null
  vendor?: string | null
  product_type?: string | null
  status?: string | null
  shopify_status?: string | null
  tags?: string[] | string | null
  description?: string | null
  description_html?: string | null
  metadata?: unknown
  shopify_product_id?: number | null
  shopify_published_at?: string | null
}

export function normalizeTags(tags: ProductInput['tags']): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
  if (typeof tags === 'string') {
    return tags.split(',').map((t) => t.trim()).filter(Boolean)
  }
  return []
}

export function buildCreatePayload(body: ProductInput) {
  const title = body.title
  if (!title || typeof title !== 'string') {
    return { error: 'title is required' as const }
  }

  const payload = {
    title,
    handle: body.handle ?? null,
    sku_label: body.sku_label ?? null,
    vendor: body.vendor ?? null,
    product_type: body.product_type ?? null,
    status: body.status ?? 'active',
    shopify_status: body.shopify_status ?? null,
    tags: normalizeTags(body.tags),
    description: body.description ?? null,
    description_html: body.description_html ?? null,
    metadata: body.metadata ?? null,
    shopify_product_id: body.shopify_product_id ?? null,
    shopify_published_at: body.shopify_published_at ?? null,
  }

  return { payload }
}

export function buildUpdatePayload(body: ProductInput) {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid body' as const }
  }

  const update: Record<string, unknown> = {}
  const maybeSet = (key: keyof ProductInput) => {
    if (key in body) {
      if (key === 'tags') {
        update[key] = normalizeTags(body.tags)
      } else {
        // @ts-expect-error dynamic
        update[key] = body[key] ?? null
      }
    }
  }

  ;[
    'title',
    'handle',
    'sku_label',
    'vendor',
    'product_type',
    'status',
    'shopify_status',
    'tags',
    'description',
    'description_html',
    'metadata',
    'shopify_product_id',
    'shopify_published_at',
  ].forEach((k) => maybeSet(k as keyof ProductInput))

  return { payload: update }
}

