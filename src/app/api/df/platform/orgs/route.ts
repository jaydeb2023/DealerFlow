import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { guardSuper, fail } from '@/lib/df/server'
import { createOrg } from '@/lib/df/orgs'

export const dynamic = 'force-dynamic'

/** Every company with simple usage counts (numbers only, never their customer data). */
export async function GET() {
  const g = await guardSuper()
  if (!g.ok) return g.res
  const { data: orgs, error } = await g.raw.from('df_orgs')
    .select('id,name,slug,status,plan,trial_ends_at,owner_email,contact_mobile,notes,max_users,max_dealers,created_at').order('created_at', { ascending: false })
  if (error) return fail(error.message, 500)
  const count = async (t: string) => {
    const { data } = await g.raw.from(t).select('org_id').limit(50000)
    const m: Record<string, number> = {}
    ;(data || []).forEach((r: any) => { m[r.org_id] = (m[r.org_id] || 0) + 1 })
    return m
  }
  const lastAct: Record<string, string> = {}
  const { data: au } = await g.raw.from('df_audit').select('org_id,created_at').order('created_at', { ascending: false }).limit(5000)
  ;(au || []).forEach((r: any) => { if (r.org_id && !lastAct[r.org_id]) lastAct[r.org_id] = r.created_at })
  const [staff, dealers, orders, invoices] = await Promise.all([count('df_staff'), count('df_dealers'), count('df_orders'), count('df_invoices')])
  return NextResponse.json({
    data: (orgs || []).map(o => ({ ...o, staff: staff[o.id] || 0, dealers: dealers[o.id] || 0, orders: orders[o.id] || 0, invoices: invoices[o.id] || 0, last_activity: lastAct[o.id] || null })),
  })
}

/** Create a company and its first admin login (temporary password is shown once). */
export async function POST(req: NextRequest) {
  const g = await guardSuper()
  if (!g.ok) return g.res
  const b = await req.json().catch(() => ({}))
  const name = String(b.name || '').trim()
  const email = String(b.owner_email || '').trim().toLowerCase()
  if (!name) return fail('Company name is required')
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter the first admin\'s email')
  const { data: dupe } = await g.raw.from('df_staff').select('id').ilike('email', email).maybeSingle()
  if (dupe) return fail('This email already belongs to a company.')

  const temp = crypto.randomBytes(9).toString('base64url')
  const cu = await g.raw.auth.admin.createUser({ email, password: temp, email_confirm: true, user_metadata: { full_name: b.owner_name || null } })
  let userId: string | null = null
  if (cu.error) { if (!/already|registered|exists/i.test(cu.error.message)) return fail(cu.error.message) } else userId = cu.data.user.id

  const made = await createOrg(g.raw, {
    name, ownerEmail: email, ownerName: b.owner_name || undefined, ownerUserId: userId,
    status: b.status === 'active' ? 'active' : 'trial', trialDays: Number(b.trial_days) || 14, plan: b.plan || null,
  })
  if (!made.ok) return fail(made.error)
  return NextResponse.json({ org: made.org, temp_password: cu.error ? null : temp, existing_login: !!cu.error })
}
