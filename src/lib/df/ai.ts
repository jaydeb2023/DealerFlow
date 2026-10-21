// AI business assistant: the language model may only CALL these fixed, read-only tools.
// It never writes SQL and never sees data the signed-in role may not see.
import type { Db } from './server'
import type { DfRole } from './constants'
import { runReport, type Report } from './reports'
import { num, round2, todayISO, addDays, inr } from './util'

export interface ToolDef { name: string; description: string; roles: DfRole[]; params?: Record<string, { type: string; description: string }> }

export const TOOLS: ToolDef[] = [
  { name: 'top_outstanding_dealers', description: 'Dealers with the highest outstanding balance (what they owe).', roles: ['admin', 'sales_manager', 'finance'], params: { limit: { type: 'number', description: 'How many dealers (default 10)' } } },
  { name: 'overdue_invoices', description: 'Unpaid invoice ageing per dealer, including overdue amounts.', roles: ['admin', 'sales_manager', 'finance'] },
  { name: 'low_stock_products', description: 'Products at or below their reorder level or out of stock.', roles: ['admin', 'sales_manager', 'warehouse', 'finance'] },
  { name: 'inactive_dealers', description: 'Active dealers who have not placed an order in the last N days.', roles: ['admin', 'sales_manager'], params: { days: { type: 'number', description: 'Days without an order (default 60)' } } },
  { name: 'top_products', description: 'Best selling products by sales value in a period.', roles: ['admin', 'sales_manager'], params: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } } },
  { name: 'overdue_dispatch_orders', description: 'Approved orders that have waited more than 48 hours for dispatch.', roles: ['admin', 'sales_manager', 'warehouse'] },
  { name: 'sales_summary', description: 'Sales totals, trend and top dealers for a period.', roles: ['admin', 'sales_manager', 'finance'], params: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } } },
]

export interface ToolResult { tool: string; title: string; period?: string; scope: string; columns: Report['columns']; rows: any[]; summary?: Report['summary']; note?: string }

export async function runTool(db: Db, name: string, args: any, scope: { role: string; staffId: string }): Promise<ToolResult> {
  const def = TOOLS.find(t => t.name === name)
  if (!def) throw new Error('Unknown tool')
  if (scope.role !== 'admin' && !def.roles.includes(scope.role as DfRole)) throw new Error('Your role is not allowed to see this information.')
  const from = typeof args?.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.from) ? args.from : addDays(todayISO(), -29)
  const to = typeof args?.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.to) ? args.to : todayISO()
  const wrap = (r: Report, rows = r.rows, period?: string): ToolResult => ({ tool: name, title: r.title, period, scope: 'All data your role may see in this company', columns: r.columns, rows, summary: r.summary, note: r.note })

  if (name === 'top_outstanding_dealers') {
    const limit = Math.min(50, Math.max(1, Math.round(num(args?.limit, 10))))
    const [{ data: bal }, { data: dl }] = await Promise.all([db.rpc('df_dealer_balances', {}), db.from('df_dealers').select('id,name,dealer_code,credit_limit').limit(5000)])
    const dm = new Map<string, any>((dl || []).map((d: any) => [d.id, d]))
    const rows = (bal || []).filter((b: any) => num(b.balance) > 0).sort((a: any, b: any) => num(b.balance) - num(a.balance)).slice(0, limit)
      .map((b: any) => ({ dealer: dm.get(b.dealer_id)?.name, code: dm.get(b.dealer_id)?.dealer_code, balance: round2(num(b.balance)), overdue: round2(num(b.overdue)), credit_limit: num(dm.get(b.dealer_id)?.credit_limit) }))
    return { tool: name, title: 'Highest outstanding balances', period: `as of ${todayISO()}`, scope: 'All dealers', columns: [{ key: 'dealer', label: 'Dealer' }, { key: 'code', label: 'Code' }, { key: 'balance', label: 'Outstanding', type: 'money' }, { key: 'overdue', label: 'Of which overdue', type: 'money' }, { key: 'credit_limit', label: 'Credit limit', type: 'money' }], rows, note: 'Outstanding = opening balance + invoices - all payments received.' }
  }
  if (name === 'overdue_invoices') { const r = await runReport(db, 'ageing', {}, scope); return wrap(r, r.rows.filter((x: any) => x.total - x.current > 0), `as of ${todayISO()}`) }
  if (name === 'low_stock_products') { const r = await runReport(db, 'inventory', {}, scope); return wrap(r, r.rows.filter((x: any) => x.status !== 'OK'), `as of ${todayISO()}`) }
  if (name === 'inactive_dealers') {
    const days = Math.max(1, Math.round(num(args?.days, 60)))
    const r = await runReport(db, 'dealer_frequency', { from: addDays(todayISO(), -days), to: todayISO() }, scope)
    return wrap({ ...r, title: `Dealers with no order in the last ${days} days` }, r.rows.filter((x: any) => x.days_since === null || x.days_since >= days), `last ${days} days`)
  }
  if (name === 'top_products') { const r = await runReport(db, 'sales_by_product', { from, to }, scope); return wrap(r, r.rows.slice(0, 10), `${from} to ${to}`) }
  if (name === 'overdue_dispatch_orders') { const r = await runReport(db, 'fulfilment', { from: addDays(todayISO(), -60), to: todayISO() }, scope); return wrap({ ...r, title: 'Orders overdue for dispatch' }, r.rows.filter((x: any) => x.state === 'Overdue for dispatch'), 'approved in the last 60 days') }
  if (name === 'sales_summary') {
    const [t, d] = await Promise.all([runReport(db, 'sales_trend', { from, to, group: 'week' }, scope), runReport(db, 'sales_by_dealer', { from, to }, scope)])
    const rows = [{ metric: 'Orders', value: t.summary?.[0]?.value }, { metric: 'Sales (incl. GST)', value: inr(t.summary?.[1]?.value) }, ...d.rows.slice(0, 5).map((r: any, i: number) => ({ metric: `Top dealer #${i + 1}: ${r.name}`, value: inr(r.sales) }))]
    return { tool: name, title: 'Sales summary', period: `${from} to ${to}`, scope: 'All orders from approval onwards', columns: [{ key: 'metric', label: 'Measure' }, { key: 'value', label: 'Value' }], rows }
  }
  throw new Error('Unknown tool')
}

/** Without a language model: pick a tool from the words in the question. */
export function routeQuestion(q: string): { tool: string; args: any } | null {
  const s = q.toLowerCase()
  const n = (s.match(/(\d{1,3})\s*days?/) || [])[1]
  const monthStart = todayISO().slice(0, 8) + '01'
  if (/(not|haven'?t|no).*(order|purchas)|inactive|dormant/.test(s)) return { tool: 'inactive_dealers', args: { days: n ? Number(n) : 60 } }
  if (/overdue.*dispatch|dispatch.*(late|overdue|pending|delay)|pending dispatch|waiting.*dispatch/.test(s)) return { tool: 'overdue_dispatch_orders', args: {} }
  if (/low.?stock|reorder|below|running out|out of stock|stock level/.test(s)) return { tool: 'low_stock_products', args: {} }
  if (/overdue|ageing|aging|unpaid invoice/.test(s)) return { tool: 'overdue_invoices', args: {} }
  if (/outstanding|owe|receivable|balance|dues?\b/.test(s)) return { tool: 'top_outstanding_dealers', args: { limit: 10 } }
  if (/top|best|most|selling|sold/.test(s) && /product|item|sku|sold|selling/.test(s)) return { tool: 'top_products', args: /this month/.test(s) ? { from: monthStart } : {} }
  if (/summar|performance|how (are|is) (we|sales)|sales/.test(s)) return { tool: 'sales_summary', args: /this month/.test(s) ? { from: monthStart } : {} }
  return null
}

export const SYSTEM_PROMPT = `You are the business assistant inside DealerFlow AI, used by a distributor's staff.
Rules: answer ONLY from the data returned by the tools. Never invent or estimate numbers. State the period and scope the data covers.
If the tools cannot answer the question, say so plainly and list what you can answer. You can only read data; you cannot perform actions, so never claim you did something (sent a message, changed an order, recorded a payment).
Keep answers short, in plain business language, with amounts in Indian rupees. The full table is shown to the user separately, so summarise the key points instead of repeating every row.`

export async function askGroq(messages: any[], tools: ToolDef[]): Promise<any> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('NO_KEY')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', temperature: 0.1, messages,
      tools: tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: { type: 'object', properties: t.params || {} } } })), tool_choice: 'auto',
    }),
  })
  const j: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error?.message || `AI service returned ${res.status}`)
  return j.choices?.[0]?.message
}
