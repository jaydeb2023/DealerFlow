import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/df/server'
import { defaultCompany } from '@/lib/df/orgs'

export const dynamic = 'force-dynamic'

/** Company settings. Everyone signed in may read the company block (needed for printing); only admin writes. */
export async function GET() {
  const g = await guard()
  if (!g.ok) return g.res
  const { data } = await g.db.from('df_settings').select('value').eq('key', 'company').maybeSingle()
  const company = { ...defaultCompany(g.org.name), ...((data?.value as any) || {}) }
  if (g.staff.role !== 'admin' && g.staff.role !== 'finance' && g.staff.role !== 'sales_manager') { delete company.bank_details }
  return NextResponse.json({ company, org: { name: g.org.name, slug: g.org.slug, status: g.org.status, plan: g.org.plan, trial_ends_at: g.org.trial_ends_at, max_users: g.org.max_users, max_dealers: g.org.max_dealers } })
}

export async function PUT(req: NextRequest) {
  const g = await guard([])
  if (!g.ok) return g.res
  const b = await req.json().catch(() => ({}))
  if (!b.company || typeof b.company !== 'object') return fail('Invalid settings')
  const c = b.company
  const clean = {
    ...defaultCompany(g.org.name),
    name: String(c.name || g.org.name).slice(0, 120), tagline: String(c.tagline || '').slice(0, 160), address: String(c.address || '').slice(0, 400),
    gstin: String(c.gstin || '').toUpperCase().slice(0, 15), state: String(c.state || '').slice(0, 60), phone: String(c.phone || '').slice(0, 30),
    email: String(c.email || '').slice(0, 120), invoice_terms: String(c.invoice_terms || '').slice(0, 600), bank_details: String(c.bank_details || '').slice(0, 600),
    upi_id: String(c.upi_id || '').slice(0, 80), default_payment_terms_days: Math.max(0, Math.min(365, Number(c.default_payment_terms_days) || 30)),
    approval_required: c.approval_required !== false, require_credit_check: c.require_credit_check !== false, low_stock_alerts: c.low_stock_alerts !== false,
  }
  const { error } = await g.db.from('df_settings').upsert({ key: 'company', value: clean, updated_at: new Date().toISOString() }, { onConflict: 'org_id,key' })
  if (error) return fail(error.message, 400)
  await audit(g.db, g.staff, 'df_settings', 'company', 'update', clean)
  return NextResponse.json({ ok: true })
}
