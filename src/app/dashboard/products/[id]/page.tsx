'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Variant {
  id: string
  title: string
  sku: string | null
  price: number | null
  compare_at_price: number | null
  weight: number | null
  weight_unit: string | null
  inventory_quantity: number | null
  position: number
  option1: string | null
  option2: string | null
  option3: string | null
  shopify_variant_id: number | null
}

interface ProductDetail {
  id: string
  title: string
  handle: string
  sku_label: string | null
  vendor: string | null
  product_type: string | null
  status: string
  shopify_status: string
  tags: string[]
  description: string | null
  description_html: string | null
  shopify_product_id: number | null
  shopify_published_at: string | null
  created_at: string
  updated_at: string
  last_synced_at: string | null
  metadata: Record<string, unknown> | null
  variants: Variant[]
  unassociated_media?: UnassociatedMedia[]
}

interface UnassociatedMedia {
  id: string
  shopify_media_id: string
  source_url: string
  filename: string | null
  alt_text: string | null
  mime_type: string | null
  width: number | null
  height: number | null
  position: number | null
  shopify_variant_id?: number | null
  is_variant_hero?: boolean
  shopify_created_at: string | null
  shopify_updated_at: string | null
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingProduct, setSavingProduct] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [variantMessage, setVariantMessage] = useState<string | null>(null)
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null)
  const [newVariant, setNewVariant] = useState<Partial<Variant>>({
    title: '',
    sku: '',
    price: null,
    inventory_quantity: null,
    option1: '',
    option2: '',
    option3: '',
    shopify_variant_id: null,
  })

  const [form, setForm] = useState({
    title: '',
    handle: '',
    sku_label: '',
    vendor: '',
    product_type: '',
    status: '',
    tags: '',
    description: '',
    description_html: '',
  })

  const applyProductToForm = (p: ProductDetail) => {
    setForm({
      title: p.title || '',
      handle: p.handle || '',
      sku_label: p.sku_label || '',
      vendor: p.vendor || '',
      product_type: p.product_type || '',
      status: p.status || '',
      tags: (p.tags || []).join(', '),
      description: p.description || '',
      description_html: p.description_html || '',
    })
  }

  const fetchProduct = async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/products/${id}`, { signal })
      if (res.status === 404) {
        setError('Product not found')
        return
      }
      if (res.status === 401) {
        router.push('/auth/login')
        return
      }
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load product')
      }
      setProduct(data.product)
      applyProductToForm(data.product)
    } catch (err) {
      if (signal?.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchProduct(controller.signal)
    return () => controller.abort()
  }, [id, router])

  const handleProductChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveProduct = async () => {
    if (!product) return
    setSavingProduct(true)
    setMessage(null)
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const payload = {
        title: form.title,
        handle: form.handle || null,
        sku_label: form.sku_label || null,
        vendor: form.vendor || null,
        product_type: form.product_type || null,
        status: form.status || null,
        shopify_status: form.shopify_status || null,
        tags,
        description: form.description || null,
        description_html: form.description_html || null,
      }
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update product')
      }
      setProduct(data.product)
      applyProductToForm(data.product)
      setMessage('Product updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product')
    } finally {
      setSavingProduct(false)
    }
  }

  const handleVariantFieldChange = (id: string, key: keyof Variant, value: string) => {
    if (!product) return
    setProduct({
      ...product,
      variants: product.variants.map((v) =>
        v.id === id ? { ...v, [key]: value === '' ? null : value } : v
      ),
    })
  }

  const handleVariantNumberChange = (id: string, key: keyof Variant, value: string) => {
    const num = value === '' ? null : Number(value)
    if (value === '' || !Number.isNaN(num)) {
      if (!product) return
      setProduct({
        ...product,
        variants: product.variants.map((v) =>
          v.id === id ? { ...v, [key]: num } : v
        ),
      })
    }
  }

  const saveVariant = async (variant: Variant) => {
    setVariantMessage(null)
    try {
      const res = await fetch(`/api/variants/${variant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: variant.title,
          sku: variant.sku,
          price: variant.price,
          compare_at_price: variant.compare_at_price,
          weight: variant.weight,
          weight_unit: variant.weight_unit,
          inventory_quantity: variant.inventory_quantity,
          position: variant.position,
          option1: variant.option1,
          option2: variant.option2,
          option3: variant.option3,
          shopify_variant_id: variant.shopify_variant_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update variant')
      await fetchProduct()
      setEditingVariantId(null)
      setVariantMessage('Variant updated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update variant')
    }
  }

  const deleteVariant = async (id: string) => {
    setVariantMessage(null)
    try {
      const res = await fetch(`/api/variants/${id}`, { method: 'DELETE' })
      const data = res.ok ? null : await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to delete variant')
      await fetchProduct()
      setVariantMessage('Variant deleted')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete variant')
    }
  }

  const createVariant = async () => {
    if (!product) return
    setVariantMessage(null)
    try {
      const res = await fetch('/api/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          title: newVariant.title || null,
          sku: newVariant.sku || null,
          price: newVariant.price,
          inventory_quantity: newVariant.inventory_quantity,
          option1: newVariant.option1 || null,
          option2: newVariant.option2 || null,
          option3: newVariant.option3 || null,
          shopify_variant_id: newVariant.shopify_variant_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create variant')
      setNewVariant({
        title: '',
        sku: '',
        price: null,
        inventory_quantity: null,
        option1: '',
        option2: '',
        option3: '',
        shopify_variant_id: null,
      })
      await fetchProduct()
      setVariantMessage('Variant added')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create variant')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-5 h-5 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin mr-2" />
        Loading product...
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl p-6">
        {error || 'Product not found'}
      </div>
    )
  }

  const metaEntries = product.metadata ? Object.entries(product.metadata) : []

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div>
            <h1 className="text-3xl font-bold text-white">{product.title}</h1>
            <p className="text-slate-400 mt-1">{product.handle}</p>
            <p className="text-xs text-slate-500 mt-1">Shopify Product ID: <span className="font-mono text-slate-300">{product.shopify_product_id ?? '—'}</span></p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">SKU Label</span>
              <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold">
                {product.sku_label || 'No SKU label'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">Vendor</span>
              <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-200 text-xs">
                {product.vendor || 'No vendor'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">Type</span>
              <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-200 text-xs">
                {product.product_type || 'No type'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">Shopify Status</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  product.shopify_status === 'ACTIVE'
                    ? 'bg-green-500/15 text-green-300'
                    : product.shopify_status === 'DRAFT'
                      ? 'bg-yellow-500/15 text-yellow-300'
                      : 'bg-slate-700 text-slate-200'
                }`}
              >
                {product.shopify_status}
              </span>
            </div>
            {product.tags?.length ? (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-slate-500 uppercase tracking-wide">Tags</span>
                <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-200 text-xs">
                  {product.tags.join(', ')}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="text-right text-slate-400 text-sm">
          <p>Last synced: {product.last_synced_at ? new Date(product.last_synced_at).toLocaleString() : '—'}</p>
          <p>Updated: {new Date(product.updated_at).toLocaleString()}</p>
          <p>Created: {new Date(product.created_at).toLocaleString()}</p>
        </div>
      </div>

      {/* Product form */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Product details</h2>
          <div className="flex items-center gap-3">
            {message ? <span className="text-sm text-green-300">{message}</span> : null}
            <button
              onClick={handleSaveProduct}
              disabled={savingProduct}
              className="px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 disabled:opacity-60"
            >
              {savingProduct ? 'Saving…' : 'Save product'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Title
            <input
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
              value={form.title}
              onChange={(e) => handleProductChange('title', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Handle
            <input
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
              value={form.handle}
              onChange={(e) => handleProductChange('handle', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            SKU Label
            <input
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white font-mono"
              value={form.sku_label}
              onChange={(e) => handleProductChange('sku_label', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Vendor
            <input
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
              value={form.vendor}
              onChange={(e) => handleProductChange('vendor', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Type
            <input
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
              value={form.product_type}
              onChange={(e) => handleProductChange('product_type', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Status
            <input
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
              value={form.status}
              onChange={(e) => handleProductChange('status', e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-1 text-sm text-slate-200">
            <span>Shopify Status</span>
            <span
              className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                product.shopify_status === 'ACTIVE'
                  ? 'bg-green-500/15 text-green-300'
                  : product.shopify_status === 'DRAFT'
                    ? 'bg-yellow-500/15 text-yellow-300'
                    : 'bg-slate-700 text-slate-200'
              }`}
            >
              {product.shopify_status || '—'}
            </span>
          </div>
          <label className="flex flex-col gap-1 text-sm text-slate-200">
            Tags (comma separated)
            <input
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
              value={form.tags}
              onChange={(e) => handleProductChange('tags', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200 md:col-span-2">
            Description (plain)
            <textarea
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white min-h-24"
              value={form.description}
              onChange={(e) => handleProductChange('description', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-200 md:col-span-2">
            Description HTML
            <textarea
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white min-h-24"
              value={form.description_html}
              onChange={(e) => handleProductChange('description_html', e.target.value)}
            />
          </label>
        </div>
      </div>


      {/* Variants */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Variants</h2>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <span>{product.variants.length} variants</span>
            {variantMessage ? <span className="text-green-300">{variantMessage}</span> : null}
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50 text-slate-400 text-sm">
              <th className="px-6 py-3 text-left">Title</th>
              <th className="px-6 py-3 text-left">SKU</th>
              <th className="px-6 py-3 text-left">Price</th>
              <th className="px-6 py-3 text-left">Inventory</th>
              <th className="px-6 py-3 text-left">Options</th>
              <th className="px-6 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {product.variants.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-slate-400">
                  No variants
                </td>
              </tr>
            ) : (
              product.variants.map((variant) => {
                const hero = product.unassociated_media?.find(
                  (m) => m.is_variant_hero && m.shopify_variant_id === variant.shopify_variant_id
                )
                return (
                <tr key={variant.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4 text-white">
                    <div className="flex items-start gap-3">
                      {hero?.source_url ? (
                        <img
                          src={hero.source_url}
                          alt={hero.alt_text || hero.filename || 'Variant hero'}
                          className="w-14 h-14 rounded border border-slate-700 object-contain bg-slate-900"
                          loading="lazy"
                        />
                      ) : null}
                      <div>
                        {editingVariantId === variant.id ? (
                          <input
                            className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white w-full"
                            value={variant.title || ''}
                            onChange={(e) => handleVariantFieldChange(variant.id, 'title', e.target.value)}
                          />
                        ) : (
                          <div className="font-medium">{variant.title}</div>
                        )}
                        <div className="text-xs text-slate-500">Shopify ID: {variant.shopify_variant_id ?? '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-200 font-mono text-sm">
                    {editingVariantId === variant.id ? (
                      <input
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white w-full font-mono text-sm"
                        value={variant.sku || ''}
                        onChange={(e) => handleVariantFieldChange(variant.id, 'sku', e.target.value)}
                      />
                    ) : (
                      variant.sku || '—'
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-200">
                    {editingVariantId === variant.id ? (
                      <div className="flex gap-2">
                        <input
                          className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white w-24"
                          value={variant.price ?? ''}
                          onChange={(e) => handleVariantNumberChange(variant.id, 'price', e.target.value)}
                          placeholder="Price"
                        />
                        <input
                          className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white w-24"
                          value={variant.compare_at_price ?? ''}
                          onChange={(e) => handleVariantNumberChange(variant.id, 'compare_at_price', e.target.value)}
                          placeholder="Compare at"
                        />
                      </div>
                    ) : (
                      <>
                        ${variant.price?.toFixed(2) ?? '—'}
                        {variant.compare_at_price ? (
                          <span className="text-xs text-slate-500 ml-2">
                            (Compare at ${variant.compare_at_price.toFixed(2)})
                          </span>
                        ) : null}
                      </>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-200">
                    {editingVariantId === variant.id ? (
                      <input
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white w-20"
                        value={variant.inventory_quantity ?? ''}
                        onChange={(e) => handleVariantNumberChange(variant.id, 'inventory_quantity', e.target.value)}
                      />
                    ) : (
                      variant.inventory_quantity ?? '—'
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-200 text-sm">
                    {editingVariantId === variant.id ? (
                      <div className="flex gap-2 flex-wrap">
                        <input
                          className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white w-20"
                          value={variant.option1 || ''}
                          onChange={(e) => handleVariantFieldChange(variant.id, 'option1', e.target.value)}
                          placeholder="Option1"
                        />
                        <input
                          className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white w-20"
                          value={variant.option2 || ''}
                          onChange={(e) => handleVariantFieldChange(variant.id, 'option2', e.target.value)}
                          placeholder="Option2"
                        />
                        <input
                          className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white w-20"
                          value={variant.option3 || ''}
                          onChange={(e) => handleVariantFieldChange(variant.id, 'option3', e.target.value)}
                          placeholder="Option3"
                        />
                      </div>
                    ) : (
                      [variant.option1, variant.option2, variant.option3].filter(Boolean).join(' / ') || '—'
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-200">
                    <div className="flex items-center gap-2">
                      {editingVariantId === variant.id ? (
                        <>
                          <button
                            className="px-3 py-1 rounded bg-amber-500 text-black text-xs font-semibold"
                            onClick={() => saveVariant(variant)}
                          >
                            Save
                          </button>
                          <button
                            className="px-3 py-1 rounded bg-slate-700 text-white text-xs"
                            onClick={() => {
                              setEditingVariantId(null)
                              fetchProduct()
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="px-3 py-1 rounded bg-slate-700 text-white text-xs"
                            onClick={() => setEditingVariantId(variant.id)}
                          >
                            Edit
                          </button>
                          <button
                            className="px-3 py-1 rounded bg-red-600 text-white text-xs"
                            onClick={() => deleteVariant(variant.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add variant */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Add variant</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <input
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
            placeholder="Title"
            value={newVariant.title || ''}
            onChange={(e) => setNewVariant({ ...newVariant, title: e.target.value })}
          />
          <input
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white font-mono"
            placeholder="SKU"
            value={newVariant.sku || ''}
            onChange={(e) => setNewVariant({ ...newVariant, sku: e.target.value })}
          />
          <input
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
            placeholder="Price"
            value={newVariant.price ?? ''}
            onChange={(e) => setNewVariant({ ...newVariant, price: e.target.value === '' ? null : Number(e.target.value) })}
          />
          <input
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
            placeholder="Inventory"
            value={newVariant.inventory_quantity ?? ''}
            onChange={(e) => setNewVariant({ ...newVariant, inventory_quantity: e.target.value === '' ? null : Number(e.target.value) })}
          />
          <input
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
            placeholder="Option 1"
            value={newVariant.option1 || ''}
            onChange={(e) => setNewVariant({ ...newVariant, option1: e.target.value })}
          />
          <input
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
            placeholder="Option 2"
            value={newVariant.option2 || ''}
            onChange={(e) => setNewVariant({ ...newVariant, option2: e.target.value })}
          />
          <input
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white"
            placeholder="Option 3"
            value={newVariant.option3 || ''}
            onChange={(e) => setNewVariant({ ...newVariant, option3: e.target.value })}
          />
          <input
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-white font-mono"
            placeholder="Shopify Variant ID"
            value={newVariant.shopify_variant_id ?? ''}
            onChange={(e) => setNewVariant({ ...newVariant, shopify_variant_id: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </div>
        <button
          className="px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400"
          onClick={createVariant}
        >
          Add variant
        </button>
      </div>

      {/* Unassociated Shopify Media */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Shopify Media (Unassociated)</h2>
          <span className="text-slate-400 text-sm">
            {product.unassociated_media?.length ?? 0} item(s)
          </span>
        </div>
        {(!product.unassociated_media || product.unassociated_media.length === 0) ? (
          <p className="text-slate-400">No unassociated Shopify media.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {product.unassociated_media.map((media) => (
              <div
                key={media.id}
                className="bg-slate-900/50 border border-slate-700/50 rounded-lg overflow-hidden"
              >
                {media.source_url ? (
                  <div className="bg-slate-950 flex items-center justify-center p-3">
                    <img
                      src={media.source_url}
                      alt={media.alt_text || media.filename || 'Shopify image'}
                      className="w-full max-h-40 object-contain"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="bg-slate-950 flex items-center justify-center text-slate-500 min-h-32">
                    No preview
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Position: {media.position ?? '—'}</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300">
                        Unassociated
                      </span>
                      {media.is_variant_hero ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200">
                          Variant hero ({product.variants.find(v => v.shopify_variant_id === media.shopify_variant_id)?.title
                            || media.shopify_variant_id || 'unknown'})
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm text-white truncate">{media.filename || media.shopify_media_id}</p>
                  <p className="text-xs text-slate-500 truncate">{media.alt_text || 'No alt text'}</p>
                  <div className="text-xs text-slate-500 flex gap-2">
                    {media.width && media.height ? (
                      <span>{media.width}×{media.height}</span>
                    ) : null}
                    {media.mime_type ? <span>{media.mime_type}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Metadata</h2>
        {metaEntries.length === 0 ? (
          <p className="text-slate-400">No metadata</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {metaEntries.map(([key, value]) => (
              <div key={key} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">{key}</p>
                <pre className="text-sm text-slate-200 whitespace-pre-wrap break-words">
                  {JSON.stringify(value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

