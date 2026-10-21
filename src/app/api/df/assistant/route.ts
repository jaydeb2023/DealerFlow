import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/df/server'
import { TOOLS, SYSTEM_PROMPT, askGroq, routeQuestion, runTool, type ToolResult } from '@/lib/df/ai'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** body: { question } -> { answer, tables, mode } */
export async function POST(req: NextRequest) {
  const g = await guard(['sales_manager', 'warehouse', 'finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const b = await req.json().catch(() => ({}))
  const question = String(b.question || '').trim().slice(0, 500)
  if (question.length < 3) return fail('Ask a question about your business.')
  const scope = { role: staff.role, staffId: staff.id }
  const mine = TOOLS.filter(t => staff.role === 'admin' || t.roles.includes(staff.role))
  const tables: ToolResult[] = []
  let answer = '', mode: 'ai' | 'direct' = 'direct'

  try {
    if (process.env.GROQ_API_KEY) {
      mode = 'ai'
      const messages: any[] = [{ role: 'system', content: `${SYSTEM_PROMPT}\nToday is ${new Date().toISOString().slice(0, 10)}. The user's role is ${staff.role}.` }, { role: 'user', content: question }]
      for (let round = 0; round < 3; round++) {
        const m = await askGroq(messages, mine)
        if (!m) break
        if (!m.tool_calls?.length) { answer = m.content || ''; break }
        messages.push(m)
        for (const tc of m.tool_calls.slice(0, 3)) {
          let content: string
          try {
            const r = await runTool(db, tc.function.name, JSON.parse(tc.function.arguments || '{}'), scope)
            tables.push(r)
            content = JSON.stringify({ title: r.title, period: r.period, scope: r.scope, summary: r.summary, note: r.note, total_rows: r.rows.length, rows: r.rows.slice(0, 25) })
          } catch (e: any) { content = JSON.stringify({ error: e.message }) }
          messages.push({ role: 'tool', tool_call_id: tc.id, content })
        }
      }
    }
  } catch (e: any) {
    console.error('[df assistant]', e.message)
    mode = 'direct'; answer = ''
  }

  if (!tables.length) {
    const r = routeQuestion(question)
    if (r && (staff.role === 'admin' || mine.some(t => t.name === r.tool))) {
      try { tables.push(await runTool(db, r.tool, r.args, scope)); mode = 'direct'; answer = '' } catch (e: any) { return fail(e.message, 403) }
    }
  }
  if (!tables.length) {
    answer = answer || `I can answer questions about: ${mine.map(t => t.description.replace(/\.$/, '').toLowerCase()).join('; ')}. Try one of those, for example "Which dealers have the highest outstanding balances?"`
  } else if (!answer) {
    const t = tables[0]
    answer = `${t.title}${t.period ? ` (${t.period})` : ''}: ${t.rows.length ? `${t.rows.length} result${t.rows.length === 1 ? '' : 's'} found, shown below.` : 'nothing matches right now.'}${process.env.GROQ_API_KEY ? '' : ' (Showing the verified data directly. Connect a Groq key in your server settings to get written summaries.)'}`
  }
  await audit(db, staff, 'df_assistant', null, 'ask', { question: question.slice(0, 200), tools: tables.map(t => t.tool), mode })
  return NextResponse.json({ answer, tables, mode })
}
