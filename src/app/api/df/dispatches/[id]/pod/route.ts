import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/df/server'

export const dynamic = 'force-dynamic'
const OK = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/** Upload proof of delivery (photo or PDF, max 5 MB) to the private df-pod bucket. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['warehouse', 'sales_manager'])
  if (!g.ok) return g.res
  const { db, staff, org } = g
  const { data: d } = await db.from('df_dispatches').select('id').eq('id', params.id).maybeSingle()
  if (!d) return fail('Dispatch not found', 404)
  const fd = await req.formData().catch(() => null)
  const f = fd?.get('file')
  if (!(f instanceof File)) return fail('Choose a file')
  if (!OK.includes(f.type)) return fail('Only JPG, PNG, WebP or PDF files are allowed')
  if (f.size > 5 * 1024 * 1024) return fail('File is larger than 5 MB')
  const ext = f.type === 'application/pdf' ? 'pdf' : f.type.split('/')[1]
  const path = `${org.id}/${d.id}-${Date.now()}.${ext}`
  const up = await db.storage.from('df-pod').upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: true })
  if (up.error) return fail(`Upload failed: ${up.error.message}. Is the df-pod storage bucket created?`, 500)
  await db.from('df_dispatches').update({ pod_url: path }).eq('id', d.id)
  await audit(db, staff, 'df_dispatches', d.id, 'pod_upload')
  return NextResponse.json({ ok: true })
}

/** Redirects to a 5-minute signed link of the proof of delivery. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['warehouse', 'sales_manager', 'finance', 'dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { data: d } = await db.from('df_dispatches').select('pod_url,order:df_orders(dealer_id)').eq('id', params.id).maybeSingle()
  if (!d?.pod_url) return fail('No proof of delivery uploaded', 404)
  if (staff.role === 'dealer' && (d.order as any)?.dealer_id !== staff.dealer_id) return fail('Not allowed', 403)
  const { data, error } = await db.storage.from('df-pod').createSignedUrl(d.pod_url, 300)
  if (error || !data) return fail(error?.message || 'Could not open the file', 500)
  return NextResponse.redirect(data.signedUrl)
}
