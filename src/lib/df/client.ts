'use client'
// Browser-side helpers for the DealerFlow.
import { useCallback, useEffect, useRef, useState } from 'react'

export class ApiError extends Error {
  status: number
  code?: string
  data: any
  constructor(message: string, status: number, data: any) {
    super(message)
    this.status = status
    this.code = data?.code
    this.data = data
  }
}

export async function api<T = any>(
  url: string,
  opts: { method?: string; body?: any; form?: FormData } = {},
): Promise<T> {
  const init: RequestInit = { method: opts.method || (opts.body || opts.form ? 'POST' : 'GET'), cache: 'no-store' }
  if (opts.form) init.body = opts.form
  else if (opts.body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(opts.body)
  }
  const res = await fetch(url, init)
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = { error: text } }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data)
  return data as T
}

export function qs(params: Record<string, any>): string {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') sp.set(k, String(v)) })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** GET with loading / error / reload. Pass null to skip. */
export function useFetch<T = any>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(!!url)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (!url) { setLoading(false); return }
    const my = ++seq.current
    setLoading(true)
    try {
      const d = await api<T>(url)
      if (my === seq.current) { setData(d); setError(null) }
    } catch (e: any) {
      if (my === seq.current) setError(e.message || 'Failed to load')
    } finally {
      if (my === seq.current) setLoading(false)
    }
  }, [url])

  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load, setData }
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '-'
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** <input type=datetime-local> value from an ISO string, in local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function mapsLink(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

export function waLink(mobile: string | null | undefined): string {
  const d = (mobile || '').replace(/\D/g, '')
  return d ? `https://wa.me/${d.length === 10 ? '91' + d : d}` : '#'
}

/** Save a CSV of rows in the browser (used for error reports). */
export function downloadText(filename: string, text: string, mime = 'text/csv') {
  const blob = new Blob(['﻿' + text], { type: `${mime};charset=utf-8` })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
