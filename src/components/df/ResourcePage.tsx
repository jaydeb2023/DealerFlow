'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, ApiError, qs, useDebounced, useFetch, toLocalInput, downloadText } from '@/lib/df/client'
import { toCsv } from '@/lib/df/util'
import { Button, Card, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Textarea } from './ui'

export type OptionSpec =
  | { value: string; label: string }[]
  | { remote: string; label: (r: any) => string; params?: Record<string, any>; filter?: (r: any) => boolean }

export interface FieldDef {
  key: string
  label: string
  type?: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'checkbox' | 'tel' | 'email'
  options?: OptionSpec
  required?: boolean
  placeholder?: string
  help?: string
  full?: boolean
  default?: any
  hideOnEdit?: boolean
  step?: string
}

export interface Col { key: string; label: string; render?: (row: any) => React.ReactNode; className?: string }

export interface ResourcePageProps {
  title: string
  subtitle?: string
  resource: string
  columns: Col[]
  fields: FieldDef[]
  searchPlaceholder?: string
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[]
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
  rowActions?: (row: any, reload: () => void) => React.ReactNode
  createDefaults?: Record<string, any>
  fixedQuery?: Record<string, any>
  exportKind?: string
  createLabel?: string
  onRowClick?: (row: any) => void
  onCreated?: (row: any) => void
  /** adjust payload before it is sent */
  transform?: (payload: Record<string, any>, isEdit: boolean) => Record<string, any>
  headerExtra?: React.ReactNode
  modalTitle?: string
  empty?: string
}

/** Select options loaded from a resource, or a static list. */
export function useOptions(spec?: OptionSpec): { value: string; label: string }[] {
  const url = spec && !Array.isArray(spec)
    ? (spec.remote === 'staff' ? '/api/df/staff' : `/api/df/r/${spec.remote}${qs({ limit: 1000, ...(spec.params || {}) })}`)
    : null
  const { data } = useFetch<{ data: any[] }>(url)
  return useMemo(() => {
    if (!spec) return []
    if (Array.isArray(spec)) return spec
    return (data?.data || []).filter(r => !spec.filter || spec.filter(r)).map(r => ({ value: r.id, label: spec.label(r) }))
  }, [spec, data])
}

export function FieldInput({ f, value, onChange }: { f: FieldDef; value: any; onChange: (v: any) => void }) {
  const opts = useOptions(f.type === 'select' ? f.options : undefined)
  switch (f.type) {
    case 'textarea': return <Textarea value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={f.placeholder} />
    case 'number': return <Input type="number" step={f.step || 'any'} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? '' : e.target.value)} placeholder={f.placeholder} />
    case 'date': return <Input type="date" value={value ?? ''} onChange={e => onChange(e.target.value)} />
    case 'datetime': return <Input type="datetime-local" value={toLocalInput(value) || value || ''} onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : '')} />
    case 'checkbox': return <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-df-700" checked={!!value} onChange={e => onChange(e.target.checked)} />
    case 'select':
      return (
        <Select value={value ?? ''} onChange={e => onChange(e.target.value)}>
          <option value="">{f.required ? 'Select...' : '- none -'}</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      )
    default: return <Input type={f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : 'text'} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={f.placeholder} />
  }
}

function exportCsv(rows: any[], cols: Col[], name: string) {
  const flat = rows.map(r => Object.fromEntries(cols.map(c => { const v = r[c.key]; return [c.key, v && typeof v === 'object' ? (v.name ?? v.full_name ?? '') : v] })))
  downloadText(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(flat, cols.map(c => ({ key: c.key, label: c.label }))))
}

export default function ResourcePage(p: ResourcePageProps) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [filterVals, setFilterVals] = useState<Record<string, string>>({})
  const url = `/api/df/r/${p.resource}${qs({ q: dq, limit: 500, ...(p.fixedQuery || {}), ...filterVals })}`
  const { data, loading, error, reload } = useFetch<{ data: any[]; count: number }>(url)

  const [modal, setModal] = useState<{ row: any | null } | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [dupes, setDupes] = useState<any[] | null>(null)

  const openCreate = () => {
    const d: Record<string, any> = {}
    p.fields.forEach(f => { if (f.default !== undefined) d[f.key] = f.default })
    setForm({ ...d, ...(p.createDefaults || {}) }); setFormErr(''); setDupes(null); setModal({ row: null })
  }
  const openEdit = (row: any) => {
    const d: Record<string, any> = {}
    p.fields.forEach(f => { d[f.key] = row[f.key] })
    setForm(d); setFormErr(''); setDupes(null); setModal({ row })
  }

  const save = useCallback(async (force = false) => {
    if (!modal) return
    const isEdit = !!modal.row
    for (const f of p.fields) {
      if (f.required && !isEdit && (form[f.key] === undefined || form[f.key] === null || form[f.key] === '')) { setFormErr(`${f.label} is required`); return }
    }
    let payload: Record<string, any> = {}
    p.fields.forEach(f => {
      if (isEdit && f.hideOnEdit) return
      let v = form[f.key]
      if (f.type === 'number' && v !== '' && v !== undefined && v !== null) v = Number(v)
      if (f.type === 'checkbox') v = !!v
      else if (v === '' || v === undefined) v = null
      payload[f.key] = v
    })
    if (p.transform) payload = p.transform(payload, isEdit)
    setSaving(true); setFormErr('')
    try {
      const res = isEdit
        ? await api(`/api/df/r/${p.resource}/${modal.row.id}`, { method: 'PATCH', body: payload })
        : await api(`/api/df/r/${p.resource}`, { body: force ? { ...payload, force: true } : payload })
      toast.success(isEdit ? 'Saved' : 'Created')
      setModal(null); setDupes(null); reload()
      if (!isEdit) p.onCreated?.((res as any).data)
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'DUPLICATE') setDupes(e.data.duplicates || [])
      setFormErr(e.message)
    } finally { setSaving(false) }
  }, [modal, form, p, reload])

  const remove = async (row: any) => {
    if (!window.confirm('Delete this record? This cannot be undone.')) return
    try { await api(`/api/df/r/${p.resource}/${row.id}`, { method: 'DELETE' }); toast.success('Deleted'); reload() }
    catch (e: any) { toast.error(e.message) }
  }

  useEffect(() => {
    if (!modal) return
    setFormErr('')
  }, [modal])

  const rows = data?.data || []
  const showActions = p.canEdit !== false || p.canDelete || p.rowActions

  return (
    <div>
      <PageHeader
        title={p.title}
        subtitle={p.subtitle}
        actions={<>
          {p.headerExtra}
          {p.exportKind && <Button onClick={() => exportCsv(rows, p.columns, p.exportKind!)}><Download className="h-4 w-4" />Export CSV</Button>}
          {p.canCreate !== false && <Button variant="primary" onClick={openCreate}><Plus className="h-4 w-4" />{p.createLabel || 'New'}</Button>}
        </>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder={p.searchPlaceholder || 'Search...'} value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {(p.filters || []).map(f => (
          <Select key={f.key} className="w-auto" value={filterVals[f.key] || ''} onChange={e => setFilterVals(v => ({ ...v, [f.key]: e.target.value }))} aria-label={f.label}>
            <option value="">{f.label}: all</option>
            {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        ))}
        <span className="ml-auto text-xs text-gray-400">{data ? `${data.count} record${data.count === 1 ? '' : 's'}` : ''}</span>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !data ? <div className="py-16 text-center"><Spinner className="mx-auto h-7 w-7" /></div> : rows.length === 0 ? (
        <Empty>{p.empty || 'Nothing here yet.'}</Empty>
      ) : (
        <Table head={[...p.columns.map(c => c.label), ...(showActions ? [''] : [])]}>
          {rows.map(row => (
            <tr key={row.id} className={p.onRowClick ? 'cursor-pointer hover:bg-df-50/50' : 'hover:bg-gray-50'} onClick={p.onRowClick ? () => p.onRowClick!(row) : undefined}>
              {p.columns.map(c => <Td key={c.key} className={c.className}>{c.render ? c.render(row) : (row[c.key] ?? '-')}</Td>)}
              {showActions && (
                <Td className="whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {p.rowActions?.(row, reload)}
                    {p.canEdit !== false && <Button size="sm" variant="ghost" onClick={() => openEdit(row)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>}
                    {p.canDelete && <Button size="sm" variant="ghost" onClick={() => remove(row)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>}
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.row ? `Edit ${p.modalTitle || p.title.toLowerCase()}` : `${p.createLabel || 'New'} ${p.modalTitle || ''}`.trim()}
        wide
        footer={<>
          <Button onClick={() => setModal(null)}>Cancel</Button>
          {dupes && <Button loading={saving} onClick={() => save(true)}>Save anyway</Button>}
          <Button variant="primary" loading={saving} onClick={() => save(false)}>Save</Button>
        </>}
      >
        {formErr && <div className="mb-3"><ErrorNote>{formErr}</ErrorNote></div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {p.fields.filter(f => !(modal?.row && f.hideOnEdit)).map(f => (
            <Field key={f.key} label={f.label} help={f.help} required={f.required} className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
              <FieldInput f={f} value={form[f.key]} onChange={v => setForm(s => ({ ...s, [f.key]: v }))} />
            </Field>
          ))}
        </div>
      </Modal>
    </div>
  )
}
