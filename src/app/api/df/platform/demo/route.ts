import { NextRequest, NextResponse } from 'next/server'
import { guardSuper, fail } from '@/lib/df/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardSuper()
  if (!g.ok) return g.res
  const { data, error } = await g.raw.from('df_demo_requests').select('*').order('created_at', { ascending: false }).limit(300)
  if (error) return fail(error.message, 500)
  return NextResponse.json({ data: data || [] })
}

export async function PATCH(req: NextRequest) {
  const g = await guardSuper()
  if (!g.ok) return g.res
  const b = await req.json().catch(() => ({}))
  if (!b.id || !['new', 'contacted', 'closed'].includes(b.status)) return fail('Invalid request')
  const { error } = await g.raw.from('df_demo_requests').update({ status: b.status }).eq('id', b.id)
  if (error) return fail(error.message, 400)
  return NextResponse.json({ ok: true })
}
