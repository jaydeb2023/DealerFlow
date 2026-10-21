import { NextResponse } from 'next/server'
import { guard, isSuperEmail } from '@/lib/df/server'
import { createRouteClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guard()
  if (!g.ok) {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (user && isSuperEmail(user.email)) {
      const body = await g.res.clone().json().catch(() => ({}))
      if (body.code === 'NOT_STAFF') return NextResponse.json({ staff: null, org: null, is_super: true })
    }
    return g.res
  }
  const { staff, org, isSuper, db } = g
  let dealer: any = null
  if (staff.role === 'dealer' && staff.dealer_id) {
    const { data } = await db.from('df_dealers').select('id,name,dealer_code,status').eq('id', staff.dealer_id).maybeSingle()
    dealer = data
  }
  const { count } = await db.from('df_notifications').select('id', { count: 'exact', head: true }).eq('staff_id', staff.id).is('read_at', null)
  return NextResponse.json({
    staff: { id: staff.id, email: staff.email, full_name: staff.full_name, role: staff.role, dealer_id: staff.dealer_id },
    org: { id: org.id, name: org.name, slug: org.slug, status: org.status, plan: org.plan, trial_ends_at: org.trial_ends_at },
    dealer, unread: count || 0, is_super: isSuper,
  })
}
