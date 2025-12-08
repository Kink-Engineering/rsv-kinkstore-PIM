'use client'

import { useState, useEffect } from 'react'

interface ImportStatus {
  lastSync: {
    created_at: string
    status: string
    details: {
      total: number
      imported: number
      errors: number
    }
  } | null
  productCount: number
}

interface ImportResult {
  success: boolean
  message: string
  progress: {
    total: number
    imported: number
    skipped: number
    errors: Array<{ productId: string; error: string }>
  }
}

export default function ImportPage() {
  const [status, setStatus] = useState<ImportStatus | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/shopify/import')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch (err) {
      console.error('Failed to fetch status:', err)
    }
  }

  async function handleImport() {
    setIsImporting(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/shopify/import', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || data.error || 'Import failed')
        return
      }

      setResult(data)
      fetchStatus() // Refresh status
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Import</h1>
        <p className="text-slate-400 mt-2">
          Import products and media from external sources
        </p>
      </div>

      {/* Shopify Import Card */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-2xl">
              🛍️
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Shopify Import</h2>
              <p className="text-slate-400 text-sm">
                Import products and variants from your Shopify store
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-700/30 rounded-lg p-4">
              <p className="text-slate-400 text-sm">Products in PIM</p>
              <p className="text-2xl font-bold text-white mt-1">
                {status?.productCount ?? '—'}
              </p>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <p className="text-slate-400 text-sm">Last Sync</p>
              <p className="text-lg font-medium text-white mt-1">
                {status?.lastSync
                  ? new Date(status.lastSync.created_at).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4">
              <p className="text-slate-400 text-sm">Last Status</p>
              <p className={`text-lg font-medium mt-1 ${
                status?.lastSync?.status === 'success' 
                  ? 'text-green-400' 
                  : status?.lastSync?.status === 'partial'
                    ? 'text-yellow-400'
                    : 'text-slate-400'
              }`}>
                {status?.lastSync?.status ?? '—'}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className={`border rounded-lg p-4 ${
              result.success 
                ? 'bg-green-500/10 border-green-500/20' 
                : 'bg-yellow-500/10 border-yellow-500/20'
            }`}>
              <p className={result.success ? 'text-green-400' : 'text-yellow-400'}>
                {result.message}
              </p>
              <div className="mt-2 text-sm text-slate-400">
                <p>Total: {result.progress.total}</p>
                <p>Imported: {result.progress.imported}</p>
                {result.progress.errors.length > 0 && (
                  <p>Errors: {result.progress.errors.length}</p>
                )}
              </div>
            </div>
          )}

          {/* Import Button */}
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isImporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <span>⬇️</span>
                Import from Shopify
              </>
            )}
          </button>

          <p className="text-slate-500 text-sm text-center">
            This will import all products from Shopify. Existing products will be updated.
          </p>
        </div>
      </div>

      {/* Future: Google Drive Import */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-6 opacity-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl">
            📁
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Google Drive Import</h2>
            <p className="text-slate-400 text-sm">
              Coming in Phase 5 — Import media from Google Drive folders
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

