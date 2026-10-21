import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { guard, fail, audit } from '@/lib/df/server'

export const dynamic = 'force-dynamic'

/** Give a dealer a portal login (or reset its password). body: { email?, reset_staff_id? } */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales_manager'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { data: d } = await db.from('df_dealers').select('id,name,email,status').eq('id', params.id).maybeSingle()
  if (!d) return fail('Dealer not found', 404)
  const b = await req.json().catch(() => ({}))

  if (b.reset_staff_id) {
    const { data: t } = await db.from('df_staff').select('id,user_id').eq('id', b.reset_staff_id).eq('dealer_id', d.id).eq('role', 'dealer').maybeSingle()
    if (!t?.user_id) return fail('Login not found', 404)
    const pw = crypto.randomBytes(9).toString('base64url')
    const r = await db.auth.admin.updateUserById(t.user_id, { password: pw })
    if (r.error) return fail(r.error.message)
    await audit(db, staff, 'df_staff', t.id, 'dealer_password_reset')
    return NextResponse.json({ temp_password: pw })
  }

  const email = String(b.email || d.email || '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter the dealer\'s email address.')
  const { data: dupe } = await g.raw.from('df_staff').select('id').ilike('email', email).maybeSingle()
  if (dupe) return fail('This email already has a login (possibly in another company). Use a different email.')
  const pw = crypto.randomBytes(9).toString('base64url')
  const cu = await db.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: d.name } })
  let userId: string | null = null
  if (cu.error) { if (!/already|registered|exists/i.test(cu.error.message)) return fail(cu.error.message) } else userId = cu.data.user.id
  const { data, error } = await db.from('df_staff').insert({ user_id: userId, email, full_name: d.name, role: 'dealer', dealer_id: d.id }).select('id').single()
  if (error) return fail(error.code === '23505' ? 'This email already has a login.' : error.message)
  await audit(db, staff, 'df_staff', data.id, 'dealer_login_created', { dealer: d.name, email })
  return NextResponse.json({ ok: true, email, temp_password: cu.error ? null : pw, existing_login: !!cu.error })
}
