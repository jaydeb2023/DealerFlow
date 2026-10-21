import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** "Book a demo" form on the DealerFlow website. Hidden spam field + per-IP limit. */
const hits = new Map<string, { n: number; t: number }>()

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim()
  const now = Date.now(); const h = hits.get(ip)
  if (h && now - h.t < 10 * 60000) { h.n++; if (h.n > 5) return NextResponse.json({ error: 'Too many requests. Please try later.' }, { status: 429 }) } else hits.set(ip, { n: 1, t: now })
  const b = await req.json().catch(() => ({}))
  if (b.hp) return NextResponse.json({ ok: true })
  const name = String(b.name || '').trim().slice(0, 120)
  const phone = String(b.phone || '').trim().slice(0, 30)
  const email = String(b.email || '').trim().slice(0, 160)
  if (!name) return NextResponse.json({ error: 'Please enter your name.' }, { status: 422 })
  if (phone.replace(/\D/g, '').length < 10 && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Enter a valid phone number or email so we can reach you.' }, { status: 422 })
  const { error } = await createAdminClient().from('df_demo_requests').insert({
    name, company: String(b.company || '').slice(0, 160) || null, phone: phone || null, email: email || null, message: String(b.message || '').slice(0, 1000) || null,
  })
  if (error) return NextResponse.json({ error: 'Could not save your request. Please try again.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
