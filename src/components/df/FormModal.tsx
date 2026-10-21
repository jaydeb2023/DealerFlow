'use client'
import { useEffect, useState } from 'react'
import { Button, ErrorNote, Field, Modal } from './ui'
import { FieldDef, FieldInput } from './ResourcePage'

/** Small reusable "fill these fields and submit" dialog. */
export default function FormModal({ open, onClose, title, fields, initial, submitLabel = 'Save', onSubmit, wide = true, intro }: {
  open: boolean
  onClose: () => void
  title: string
  fields: FieldDef[]
  initial?: Record<string, any>
  submitLabel?: string
  wide?: boolean
  intro?: React.ReactNode
  onSubmit: (values: Record<string, any>) => Promise<void>
}) {
  const [v, setV] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    const d: Record<string, any> = {}
    fields.forEach(f => { d[f.key] = initial && initial[f.key] !== undefined ? initial[f.key] : f.default })
    setV(d); setErr('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async () => {
    for (const f of fields) {
      if (f.required && (v[f.key] === undefined || v[f.key] === null || v[f.key] === '')) { setErr(`${f.label} is required`); return }
    }
    const out: Record<string, any> = {}
    fields.forEach(f => {
      let x = v[f.key]
      if (f.type === 'number' && x !== '' && x !== undefined && x !== null) x = Number(x)
      if (f.type === 'checkbox') x = !!x
      else if (x === '' || x === undefined) x = null
      out[f.key] = x
    })
    setBusy(true); setErr('')
    try { await onSubmit(out); onClose() } catch (e: any) { setErr(e.message || 'Failed') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} wide={wide}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>{submitLabel}</Button></>}>
      {intro && <div className="mb-3 text-sm text-gray-600">{intro}</div>}
      {err && <div className="mb-3"><ErrorNote>{err}</ErrorNote></div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map(f => (
          <Field key={f.key} label={f.label} help={f.help} required={f.required} className={f.full || f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <FieldInput f={f} value={v[f.key]} onChange={x => setV(s => ({ ...s, [f.key]: x }))} />
          </Field>
        ))}
      </div>
    </Modal>
  )
}
