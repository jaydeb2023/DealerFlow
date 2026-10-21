import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/df/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guard()
  if (!g.ok) return g.res
  const { data, error } = await g.db.from('df_notifications').select('*').eq('staff_id', g.staff.id).order('created_at', { ascending: false }).limit(100)
  if (error) return fail(error.message, 500)
  return NextResponse.json({ data: data || [] })
}

/** Mark one (id) or all notifications as read. */
export async function PATCH(req: NextRequest) {
  const g = await guard()
  if (!g.ok) return g.res
  const b = await req.json().catch(() => ({}))
  let q = g.db.from('df_notifications').update({ read_at: new Date().toISOString() }).eq('staff_id', g.staff.id).is('read_at', null)
  if (b.id) q = q.eq('id', b.id)
  const { error } = await q
  if (error) return fail(error.message, 400)
  return NextResponse.json({ ok: true })
}
