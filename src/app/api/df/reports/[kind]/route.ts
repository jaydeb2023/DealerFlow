import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/df/server'
import { runReport, REPORT_KINDS } from '@/lib/df/reports'
import type { DfRole } from '@/lib/df/constants'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ALLOWED: Record<string, DfRole[]> = {
  sales_trend: ['sales_manager', 'finance'], sales_by_dealer: ['sales_manager', 'finance'], sales_by_product: ['sales_manager'], sales_by_territory: ['sales_manager'],
  dealer_frequency: ['sales_manager'], fulfilment: ['sales_manager', 'warehouse'], inventory: ['sales_manager', 'warehouse', 'finance'],
  ageing: ['sales_manager', 'finance'], collections: ['sales_manager', 'finance'], rep_performance: ['sales_manager'],
}

export async function GET(req: NextRequest, { params }: { params: { kind: string } }) {
  if (!(REPORT_KINDS as readonly string[]).includes(params.kind)) return fail('Unknown report', 404)
  const g = await guard(ALLOWED[params.kind])
  if (!g.ok) return g.res
  const sp = req.nextUrl.searchParams
  try {
    return NextResponse.json(await runReport(g.db, params.kind, { from: sp.get('from'), to: sp.get('to'), group: sp.get('group') }, { role: g.staff.role, staffId: g.staff.id }))
  } catch (e: any) { return fail(e.message || 'Report failed', 500) }
}
