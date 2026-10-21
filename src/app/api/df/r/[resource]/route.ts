import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, nextNo, pick } from '@/lib/df/server'
import { RESOURCES, dbMessage } from '@/lib/df/resources'
import { isGstin } from '@/lib/df/util'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { resource: string } }) {
  const cfg = RESOURCES[params.resource]
  if (!cfg) return fail('Unknown resource', 404)
  const g = await guard(cfg.read)
  if (!g.ok) return g.res
  const { db, staff } = g
  const sp = req.nextUrl.searchParams
  let q = db.from(cfg.table).select(cfg.select, { count: 'exact' })
  for (const f of cfg.filters || []) {
    const v = sp.get(f)
    if (v !== null && v !== '') q = q.eq(f, v === 'true' ? true : v === 'false' ? false : v)
  }
  if (cfg.ownerColumn && staff.role === 'sales_rep') q = q.eq(cfg.ownerColumn, staff.id)
  const orderCol = cfg.order?.col || 'created_at'
  const from = sp.get('from'), to = sp.get('to')
  if (from) q = q.gte(orderCol, from)
  if (to) q = q.lte(orderCol, to + 'T23:59:59')
  const term = (sp.get('q') || '').trim().replace(/[,()%]/g, ' ')
  if (term && cfg.search?.length) q = q.or(cfg.search.map(c => `${c}.ilike.%${term}%`).join(','))
  const limit = Math.min(Number(sp.get('limit') || 200), 1000)
  const offset = Math.max(Number(sp.get('offset') || 0), 0)
  q = q.order(orderCol, { ascending: cfg.order?.asc ?? false }).range(offset, offset + limit - 1)
  const { data, error, count } = await q
  if (error) return fail(dbMessage(error), 500)
  return NextResponse.json({ data: data || [], count: count ?? (data || []).length })
}

export async function POST(req: NextRequest, { params }: { params: { resource: string } }) {
  const cfg = RESOURCES[params.resource]
  if (!cfg || !cfg.fields.length) return fail('Unknown resource', 404)
  const g = await guard(cfg.write)
  if (!g.ok) return g.res
  const { db, staff, org } = g
  const body = await req.json().catch(() => ({}))
  let row = pick(body, cfg.fields)
  for (const r of cfg.required || []) {
    if (row[r] === undefined || row[r] === null || row[r] === '') return fail(`${r.replace(/_/g, ' ')} is required`)
  }
  if (params.resource === 'enquiries') return fail('Enquiries come from the dealer portal')
  if (params.resource === 'dealers') {
    if (row.gstin && !isGstin(row.gstin)) return fail('GSTIN is not in a valid format (15 characters, e.g. 19ABCDE1234F1Z5)')
    if (org.max_dealers) {
      const { count } = await db.from('df_dealers').select('id', { count: 'exact', head: true })
      if ((count || 0) >= org.max_dealers) return fail(`Your plan allows ${org.max_dealers} dealers. Contact Evynta to upgrade.`, 403, { code: 'PLAN_LIMIT' })
    }
    if (row.phone && !body.force) {
      const { data: dup } = await db.from('df_dealers').select('id,dealer_code,name').eq('phone_norm', String(row.phone).replace(/\D/g, '').slice(-10)).limit(3)
      if (dup && dup.length) return NextResponse.json({ error: `A dealer with this phone already exists: ${dup.map(d => d.name).join(', ')}`, code: 'DUPLICATE', duplicates: dup }, { status: 409 })
    }
  }
  if (params.resource === 'visits' && staff.role === 'sales_rep') row.rep_id = staff.id
  if (params.resource === 'visits' && !row.rep_id) row.rep_id = staff.id
  if (cfg.prepare) row = cfg.prepare(row)
  if (cfg.numbering) { const n = cfg.numbering; row[n.column] = await nextNo(db, n.counter, n.prefix, n.pad ?? 5) }
  const { data, error } = await db.from(cfg.table).insert(row).select().single()
  if (error) return fail(dbMessage(error), 400)
  if (!cfg.noAudit) await audit(db, staff, cfg.table, data.id, 'create', row)
  return NextResponse.json({ data })
}
