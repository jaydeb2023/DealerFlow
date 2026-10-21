// Server-only helpers for the DealerFlow API routes.
// Every /api/df/* route calls guard() first: it authenticates the Supabase
// session, finds the staff member and their COMPANY (org), checks the role, and hands
// back a service-role client that is SCOPED to that company: every read, update and delete
// is filtered by org_id, and every insert gets org_id stamped on it. A route therefore cannot
// read or write another company's rows by accident. The browser never talks to df_* tables.

import { NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'
import type { DfRole } from './constants'
import { createOrg } from './orgs'

export interface Staff {
  id: string
  org_id: string
  user_id: string | null
  email: string
  full_name: string | null
  dealer_id: string | null
  role: DfRole
  active: boolean
}

export interface Org {
  id: string
  name: string
  slug: string
  status: 'trial' | 'active' | 'suspended'
  plan: string | null
  trial_ends_at: string | null
  max_users: number | null
  max_dealers: number | null
}

export type RawDb = ReturnType<typeof createAdminClient>
export type Db = RawDb

export type GuardResult =
  | { ok: true; db: Db; raw: RawDb; staff: Staff; org: Org; isSuper: boolean }
  | { ok: false; res: NextResponse }

/** Tables that belong to one company. (df_orgs itself is platform-level.) */
export const TENANT_TABLES = new Set([
  'df_warehouses', 'df_territories', 'df_categories', 'df_price_lists', 'df_staff', 'df_dealers', 'df_products',
  'df_price_list_items', 'df_inventory', 'df_stock_movements', 'df_orders', 'df_order_items', 'df_order_history',
  'df_dispatches', 'df_dispatch_items', 'df_invoices', 'df_invoice_items', 'df_payments', 'df_payment_allocations',
  'df_visits', 'df_targets', 'df_enquiries', 'df_notifications', 'df_settings', 'df_counters', 'df_audit',
])

/** SQL functions that take the company as their first argument: the proxy fills it in. */
const ORG_RPCS = new Set(['df_next_number', 'df_reserve_order', 'df_release_order', 'df_dispatch_order', 'df_stock_change', 'df_stock_transfer', 'df_create_invoice', 'df_record_payment', 'df_dealer_balances'])

/** A service-role client locked to one company. */
export function scopedDb(orgId: string, base?: RawDb): Db {
  const raw = base || createAdminClient()
  const wrapFrom = (table: string) => {
    const qb: any = raw.from(table)
    if (!TENANT_TABLES.has(table)) return qb
    const stamp = (rows: any) => (Array.isArray(rows) ? rows.map(r => ({ ...r, org_id: orgId })) : { ...rows, org_id: orgId })
    return new Proxy(qb, {
      get(t, prop, recv) {
        if (prop === 'select') return (...a: any[]) => qb.select(...a).eq('org_id', orgId)
        if (prop === 'insert') return (rows: any, o?: any) => qb.insert(stamp(rows), o)
        if (prop === 'upsert') return (rows: any, o?: any) => qb.upsert(stamp(rows), o)
        if (prop === 'update') return (v: any, o?: any) => qb.update(v, o).eq('org_id', orgId)
        if (prop === 'delete') return (o?: any) => qb.delete(o).eq('org_id', orgId)
        const v = Reflect.get(t, prop, recv)
        return typeof v === 'function' ? v.bind(t) : v
      },
    })
  }
  return new Proxy(raw as any, {
    get(t, prop) {
      if (prop === '__orgId') return orgId
      if (prop === 'from') return wrapFrom
      if (prop === 'rpc') return (fn: string, args?: any, o?: any) => t.rpc(fn, ORG_RPCS.has(fn) ? { ...args, p_org: orgId } : args, o)
      const v = t[prop]
      return typeof v === 'function' ? v.bind(t) : v
    },
  }) as Db
}

export const orgIdOf = (db: Db): string => (db as any).__orgId

export function fail(message: string, status = 400, extra: Record<string, any> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

/** Platform owners (you at Evynta): RV_SUPER_ADMIN_EMAILS=a@x.com,b@y.com */
export function superEmails(): string[] {
  return (process.env.RV_SUPER_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}
export const isSuperEmail = (email?: string | null) => !!email && superEmails().includes(email.toLowerCase())

/**
 * Authenticate + authorise. `roles` omitted => any active staff member of a company in good standing.
 * First sign-in after self-signup creates the company (the person becomes its admin).
 */
export async function guard(roles?: DfRole[]): Promise<GuardResult> {
  try { return await guardInner(roles) }
  catch (e: any) { return { ok: false, res: fail(`Server setup problem: ${e?.message || e}`, 500) } }
}

// Warm-instance cache: the same verified session token skips the auth round-trip and the
// staff/company lookups for a few seconds (role or suspension changes apply within TTL).
const GUARD_TTL_MS = 15000
const guardCache = new Map<string, { at: number; user: any; staff: Staff; org: Org }>()

async function guardInner(roles?: DfRole[]): Promise<GuardResult> {
  const authClient = createRouteClient()
  const { data: { session } } = await authClient.auth.getSession()   // reads the cookie, no network
  const token = session?.access_token || ''
  const raw = createAdminClient()

  const hit = token ? guardCache.get(token) : undefined
  if (hit && Date.now() - hit.at < GUARD_TTL_MS) {
    return finish(hit.staff, hit.org, isSuperEmail(hit.user.email), raw, roles)
  }

  const { data: { user } } = await authClient.auth.getUser()         // verifies the token with Supabase
  if (!user) return { ok: false, res: fail('Please sign in.', 401) }
  let { data: staff, error: staffErr } = await raw.from('df_staff').select('*, df_orgs(id,name,slug,status,plan,trial_ends_at,max_users,max_dealers)').eq('user_id', user.id).maybeSingle()
  if (staffErr) return { ok: false, res: fail(`Database problem: ${staffErr.message}. Did you run supabase/migrations/001_dealerflow.sql in this Supabase project?`, 500) }

  if (!staff) {
    // a colleague invited this email: link the pre-created staff row on first sign-in
    const { data: byEmail } = await raw.from('df_staff').select('*')
      .ilike('email', user.email || '__none__').is('user_id', null).order('created_at').limit(1)
    if (byEmail && byEmail[0]) {
      const { data: linked } = await raw.from('df_staff').update({ user_id: user.id }).eq('id', byEmail[0].id).select().single()
      staff = linked
    }
  }

  if (!staff) {
    // brand-new company signup (company name travels in the sign-up form)
    const companyName = String((user.user_metadata as any)?.company_name || '').trim()
    if (companyName && process.env.RV_SIGNUP_OPEN !== 'false') {
      const made = await createOrg(raw, {
        name: companyName, ownerEmail: user.email || '', ownerUserId: user.id,
        ownerName: (user.user_metadata as any)?.full_name || (user.email || '').split('@')[0], status: 'trial', trialDays: 14,
      })
      if (!made.ok) return { ok: false, res: fail(made.error, 500) }
      staff = made.staff
    }
  }

  const isSuper = isSuperEmail(user.email)
  if (!staff || !staff.active) {
    return { ok: false, res: fail('Your account is not linked to a company yet. Ask your company admin to add you, or create a company account.', 403, { code: 'NOT_STAFF', is_super: isSuper }) }
  }

  let org: any = (staff as any).df_orgs
  if (Array.isArray(org)) org = org[0]
  if (!org) { const { data: o } = await raw.from('df_orgs').select('id,name,slug,status,plan,trial_ends_at,max_users,max_dealers').eq('id', staff.org_id).single(); org = o }
  delete (staff as any).df_orgs
  if (token) {
    guardCache.set(token, { at: Date.now(), user, staff: staff as Staff, org: org as Org })
    if (guardCache.size > 200) guardCache.delete(guardCache.keys().next().value as string)
  }
  return finish(staff as Staff, org as Org, isSuper, raw, roles)
}

function finish(staff: Staff, org: Org, isSuper: boolean, raw: RawDb, roles?: DfRole[]): GuardResult {
  if (!org) return { ok: false, res: fail('Company not found.', 403, { code: 'NOT_STAFF' }) }
  if (org.status === 'suspended') {
    return { ok: false, res: fail('This company account is suspended. Please contact Evynta.', 403, { code: 'ORG_SUSPENDED' }) }
  }
  if (roles && staff.role !== 'admin' && !roles.includes(staff.role)) {
    return { ok: false, res: fail('You do not have permission for this action.', 403, { code: 'FORBIDDEN' }) }
  }
  return { ok: true, db: scopedDb(org.id, raw), raw, staff: staff as Staff, org: org as Org, isSuper }
}

export type SuperResult = { ok: true; raw: RawDb; email: string } | { ok: false; res: NextResponse }

/** Platform console (all companies). Only emails listed in RV_SUPER_ADMIN_EMAILS. */
export async function guardSuper(): Promise<SuperResult> {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return { ok: false, res: fail('Please sign in.', 401) }
    if (!isSuperEmail(user.email)) return { ok: false, res: fail('Not allowed.', 403, { code: 'FORBIDDEN' }) }
    return { ok: true, raw: createAdminClient(), email: user.email! }
  } catch (e: any) { return { ok: false, res: fail(`Server setup problem: ${e?.message || e}`, 500) } }
}

export async function audit(
  db: Db, staff: Pick<Staff, 'id' | 'email'> | null, table: string, recordId: string | null,
  action: string, changes?: any,
) {
  try {
    await db.from('df_audit').insert({
      actor_id: staff?.id ?? null,
      actor_email: staff?.email ?? null,
      table_name: table,
      record_id: recordId,
      action,
      changes: changes ?? null,
    })
  } catch (e) {
    console.error('[df audit] failed', e)
  }
}

/** Sequential human-readable number, e.g. nextNo(db,'order','RV-ORD-',5) => RV-ORD-00042 */
export async function nextNo(db: Db, counter: string, prefix: string, pad = 5): Promise<string> {
  const { data, error } = await db.rpc('df_next_number', { p_name: counter })
  if (error) throw new Error(error.message)
  return prefix + String(data).padStart(pad, '0')
}

export async function getSetting<T = any>(db: Db, key: string, fallback: T): Promise<T> {
  const { data } = await db.from('df_settings').select('value').eq('key', key).maybeSingle()
  return { ...(fallback as any), ...((data?.value as any) || {}) } as T
}

/** Pick only allowed keys from a body, dropping undefined. */
const NOT_NULL_BOOL = ['active', 'consent_whatsapp', 'opt_out', 'quote_approved', 'packed', 'approved']

export function pick(body: Record<string, any>, allowed: string[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of allowed) {
    if (body[k] === undefined) continue
    if (NOT_NULL_BOOL.includes(k)) { out[k] = !!body[k]; continue }   // these columns are NOT NULL
    out[k] = body[k] === '' ? null : body[k]
  }
  return out
}

/** In-app notification to every active staff member with one of the roles (and optionally one specific staff id). */
export async function notify(db: Db, o: { roles?: DfRole[]; staffIds?: (string | null | undefined)[]; kind: string; title: string; body?: string; link?: string }) {
  try {
    const ids = new Set<string>((o.staffIds || []).filter(Boolean) as string[])
    if (o.roles?.length) {
      const { data } = await db.from('df_staff').select('id').in('role', o.roles).eq('active', true)
      ;(data || []).forEach((r: any) => ids.add(r.id))
    }
    if (!ids.size) return
    await db.from('df_notifications').insert(Array.from(ids).map(staff_id => ({ staff_id, kind: o.kind, title: o.title, body: o.body ?? null, link: o.link ?? null })))
  } catch (e) { console.error('[df notify] failed', e) }
}

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const h = req.headers.get('authorization') || ''
  return h === `Bearer ${secret}`
}
