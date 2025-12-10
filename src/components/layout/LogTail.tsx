'use client'

import { useEffect, useRef, useState } from 'react'

export function LogTail() {
  const [logText, setLogText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    fetchLogs()
    const id = setInterval(fetchLogs, 4000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const el = logRef.current
    if (!el) return
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40
    if (nearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [logText])

  async function fetchLogs() {
    try {
      setError(null)
      const res = await fetch('/api/logs/dev?lines=400', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to load logs')
        setLogText('')
        return
      }
      const text = await res.text()
      setLogText(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs')
      setLogText('')
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 border-t border-slate-800 text-xs text-slate-200 font-mono">
      <div className="px-3 py-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>Log tail (auto-scroll)</span>
        {error ? <span className="text-amber-300">⚠️ {error}</span> : null}
      </div>
      <div
        ref={logRef}
        className="h-40 overflow-y-auto px-3 pb-3 whitespace-pre-wrap leading-snug"
      >
        {logText || (!error && 'No log output yet.')}
      </div>
    </div>
  )
}

