import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { guard, fail, audit } from '@/lib/df/server'
import { STAFF_ROLES } from '@/lib/df/constants'

export const dynamic = 'force-dynamic'

/** Admin: full list. Everyone else: a short id/name/role list for assignee dropdowns. */
export async function GET() {
  const g = await guard()
  if (!g.ok) return g.res
  const full = g.staff.role === 'admin'
  const { data, error } = await g.db.from('df_staff')
    .select(full ? 'id,email,full_name,mobile,role,active,territory_id,created_at' : 'id,full_name,role')
    .neq('role', 'dealer').order('full_name')
  if (error) return fail(error.message, 500)
  return NextResponse.json({ data: data || [] })
}

/** Admin creates a login + staff row. If no password is given, a temporary one is generated and returned once. */
export async function POST(req: NextRequest) {
  const g = await guard([])
  if (!g.ok) return g.res
  const { db, staff } = g
  const b = await req.json().catch(() => ({}))
  const email = String(b.email || '').trim().toLowerCase()
  const role = String(b.role || '')
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email')
  if (!STAFF_ROLES.includes(role as any)) return fail('Choose a role')

  if (g.org.max_users) { const { count } = await db.from('df_staff').select('id', { count: 'exact', head: true }).neq('role', 'dealer').eq('active', true); if ((count || 0) >= g.org.max_users) return fail(`Your plan allows ${g.org.max_users} users. Contact Evynta to upgrade.`, 403, { code: 'PLAN_LIMIT' }) }
  const { data: dupe } = await g.raw.from('df_staff').select('id,org_id').ilike('email', email).maybeSingle()
  if (dupe) return fail(dupe.org_id === g.org.id ? 'This email is already a staff member.' : 'This email already belongs to another company. Use a different email.')

  const tempPassword = b.password ? String(b.password) : crypto.randomBytes(9).toString('base64url')
  if (tempPassword.length < 8) return fail('Password must be at least 8 characters')

  let userId: string | null = null
  const created = await db.auth.admin.createUser({ email, password: tempPassword, email_confirm: true, user_metadata: { full_name: b.full_name || null } })
  if (created.error) {
    // user may already have a Supabase login (e.g. signed up earlier) -> link by email on first sign-in
    if (!/already|registered|exists/i.test(created.error.message)) return fail(created.error.message, 400)
  } else {
    userId = created.data.user.id
  }
  const { data, error } = await db.from('df_staff').insert({
    user_id: userId, email, full_name: b.full_name || email.split('@')[0], mobile: b.mobile || null, role,
  }).select().single()
  if (error) return fail(error.code === '23505' ? 'This email already belongs to a company.' : error.message, 400)
  await audit(db, staff, 'df_staff', data.id, 'create', { email, role })
  return NextResponse.json({ data, temp_password: created.error ? null : (b.password ? null : tempPassword), existing_login: !!created.error })
}

/** Admin: change role / active / name / mobile, or reset password. */
export async function PATCH(req: NextRequest) {
  const g = await guard([])
  if (!g.ok) return g.res
  const { db, staff } = g
  const b = await req.json().catch(() => ({}))
  if (!b.id) return fail('id required')
  const { data: target } = await db.from('df_staff').select('*').eq('id', b.id).maybeSingle()
  if (!target) return fail('Not found', 404)

  const patch: Record<string, any> = {}
  if (b.role !== undefined) { if (!STAFF_ROLES.includes(b.role)) return fail('Invalid role'); patch.role = b.role }
  if (b.active !== undefined) patch.active = !!b.active
  if (b.full_name !== undefined) patch.full_name = b.full_name
  if (b.mobile !== undefined) patch.mobile = b.mobile || null

  if ((patch.role && patch.role !== 'admin') || patch.active === false) {
    if (target.role === 'admin') {
      const { count } = await db.from('df_staff').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true)
      if ((count ?? 0) <= 1) return fail('There must be at least one active admin.')
    }
  }
  let newPassword: string | null = null
  if (b.reset_password && target.user_id) {
    newPassword = crypto.randomBytes(9).toString('base64url')
    const r = await db.auth.admin.updateUserById(target.user_id, { password: newPassword })
    if (r.error) return fail(r.error.message, 400)
  }
  if (Object.keys(patch).length) {
    const { error } = await db.from('df_staff').update(patch).eq('id', b.id)
    if (error) return fail(error.message, 400)
    await audit(db, staff, 'df_staff', b.id, 'update', patch)
  }
  return NextResponse.json({ ok: true, temp_password: newPassword })
}
