// Company (org) creation shared by self-signup and the Platform console.
import crypto from 'crypto'
import type { createAdminClient } from '@/lib/supabaseServer'

type Raw = ReturnType<typeof createAdminClient>

export const newKey = () => crypto.randomBytes(24).toString('hex')

export function slugify(name: string): string {
  const s = name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return s || 'company'
}

export const defaultCompany = (name: string) => ({
  name, tagline: '', address: '', gstin: '', state: '', phone: '', email: '',
  invoice_terms: 'Payment due as per agreed credit terms.', bank_details: '', upi_id: '',
  default_payment_terms_days: 30, approval_required: true, require_credit_check: true, low_stock_alerts: true,
})

export interface NewOrg {
  name: string
  ownerEmail: string
  ownerName?: string
  ownerUserId?: string | null
  status?: 'trial' | 'active'
  trialDays?: number
  plan?: string | null
}

/** Creates the company, its default settings and (when an owner is given) its first admin. */
export async function createOrg(raw: Raw, a: NewOrg): Promise<{ ok: true; org: any; staff: any } | { ok: false; error: string }> {
  const name = a.name.trim().slice(0, 120)
  if (!name) return { ok: false, error: 'Company name is required.' }

  let slug = slugify(name)
  for (let i = 0; i < 20; i++) {
    const { data: ex } = await raw.from('df_orgs').select('id').eq('slug', slug).maybeSingle()
    if (!ex) break
    slug = `${slugify(name).slice(0, 34)}-${Math.floor(1000 + Math.random() * 9000)}`
  }
  const status = a.status || 'trial'
  const { data: org, error } = await raw.from('df_orgs').insert({
    name, slug, status, plan: a.plan ?? null, owner_email: a.ownerEmail || null,
    trial_ends_at: status === 'trial' ? new Date(Date.now() + (a.trialDays ?? 14) * 864e5).toISOString() : null,
  }).select().single()
  if (error || !org) return { ok: false, error: error?.message || 'Could not create the company.' }

  await raw.from('df_settings').insert([{ org_id: org.id, key: 'company', value: defaultCompany(name) }])
  await raw.from('df_warehouses').insert({ org_id: org.id, name: 'Main warehouse', code: 'MAIN' })

  let staff: any = null
  if (a.ownerEmail) {
    const { data: s, error: se } = await raw.from('df_staff').insert({
      org_id: org.id, user_id: a.ownerUserId ?? null, email: a.ownerEmail,
      full_name: a.ownerName || a.ownerEmail.split('@')[0], role: 'admin',
    }).select().single()
    if (se) {
      await raw.from('df_orgs').delete().eq('id', org.id)                    // do not leave an empty company behind
      if (a.ownerUserId) {                                                   // two requests raced: use the winner's row
        const { data: won } = await raw.from('df_staff').select('*').eq('user_id', a.ownerUserId).maybeSingle()
        if (won) return { ok: true, org: { id: won.org_id }, staff: won }
      }
      return { ok: false, error: /duplicate|unique/i.test(se.message) ? 'This email already belongs to a company.' : se.message }
    }
    staff = s
  }
  await raw.from('df_audit').insert({ org_id: org.id, actor_email: a.ownerEmail || 'platform', table_name: 'df_orgs', record_id: org.id, action: 'create', changes: { name, status } })
  return { ok: true, org, staff }
}
