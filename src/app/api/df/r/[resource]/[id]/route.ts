import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, pick } from '@/lib/df/server'
import { RESOURCES, dbMessage } from '@/lib/df/resources'
import { isGstin } from '@/lib/df/util'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { resource: string; id: string } }) {
  const cfg = RESOURCES[params.resource]
  if (!cfg || !cfg.fields.length) return fail('Unknown resource', 404)
  const g = await guard(cfg.write)
  if (!g.ok) return g.res
  const { db, staff } = g
  const body = await req.json().catch(() => ({}))
  let row = pick(body, cfg.fields)
  if (!Object.keys(row).length) return fail('Nothing to change')
  for (const r of cfg.required || []) if (r in row && (row[r] === null || row[r] === '')) return fail(`${r.replace(/_/g, ' ')} is required`)
  if (params.resource === 'dealers' && row.gstin && !isGstin(row.gstin)) return fail('GSTIN is not in a valid format')
  if (params.resource === 'enquiries' && row.reply && !row.status) row.status = 'replied'
  if (cfg.prepare) row = cfg.prepare(row)
  let q = db.from(cfg.table).update(row).eq('id', params.id)
  if (cfg.ownerColumn && staff.role === 'sales_rep') q = q.eq(cfg.ownerColumn, staff.id)
  const { data, error } = await q.select().maybeSingle()
  if (error) return fail(dbMessage(error), 400)
  if (!data) return fail('Not found', 404)
  if (!cfg.noAudit) await audit(db, staff, cfg.table, params.id, 'update', row)
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { resource: string; id: string } }) {
  const cfg = RESOURCES[params.resource]
  if (!cfg || !cfg.fields.length) return fail('Unknown resource', 404)
  const g = await guard(cfg.remove)
  if (!g.ok) return g.res
  const { db, staff } = g
  const { error } = await db.from(cfg.table).delete().eq('id', params.id)
  if (error) return fail(dbMessage(error), 400)
  await audit(db, staff, cfg.table, params.id, 'delete')
  return NextResponse.json({ ok: true })
}
