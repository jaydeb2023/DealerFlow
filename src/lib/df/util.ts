export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
export const num = (v: any, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d }

export function normMobile(m: any): string {
  const d = String(m ?? '').replace(/\D/g, '')
  if (!d) return ''
  return d.length > 10 ? d.slice(-10) : d
}

export const inr = (n: any) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
export const qtyFmt = (n: any) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })

export const isGstin = (s: string) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s.toUpperCase())
export const todayISO = () => new Date().toISOString().slice(0, 10)
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
export const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 864e5)

/** CSV text from rows (client + server). */
export function toCsv(rows: Record<string, any>[], cols?: { key: string; label: string }[]): string {
  const c = cols || (rows[0] ? Object.keys(rows[0]).map(k => ({ key: k, label: k })) : [])
  const esc = (v: any) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  return [c.map(x => esc(x.label)).join(','), ...rows.map(r => c.map(x => esc(r[x.key])).join(','))].join('\n')
}
