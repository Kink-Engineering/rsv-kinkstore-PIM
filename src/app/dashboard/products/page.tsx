'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Product {
  id: string
  title: string
  handle: string
  sku_label: string | null
  vendor: string | null
  product_type: string | null
  status: string
  shopify_status: string
  tags: string[]
  last_synced_at: string | null
  variants: { count: number }[]
}

interface ProductsResponse {
  products: Product[]
  total: number
  page: number
  pageSize: number
}

export default function ProductsPage() {
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    fetchProducts()
  }, [page, search])

  async function fetchProducts() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search }),
      })
      const res = await fetch(`/api/products?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Products</h1>
          <p className="text-slate-400 mt-1">
            {data?.total ?? 0} products in catalog
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-400">Product</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-400">SKU</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-400">Vendor</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-400">Type</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-400">Variants</th>
              <th className="px-6 py-4 text-left text-sm font-medium text-slate-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : data?.products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  No products found
                </td>
              </tr>
            ) : (
              data?.products.map((product) => (
                <tr 
                  key={product.id} 
                  className="hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link 
                      href={`/dashboard/products/${product.id}`}
                      className="text-white hover:text-amber-400 font-medium transition-colors"
                    >
                      {product.title}
                    </Link>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {product.handle}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-300 font-mono text-sm">
                      {product.sku_label || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {product.vendor || '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {product.product_type || '—'}
                  </td>
                  <td className="px-6 py-4 text-slate-300">
                    {product.variants?.[0]?.count ?? 0}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      product.shopify_status === 'ACTIVE'
                        ? 'bg-green-500/20 text-green-400'
                        : product.shopify_status === 'DRAFT'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {product.shopify_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, data?.total ?? 0)} of {data?.total} products
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

