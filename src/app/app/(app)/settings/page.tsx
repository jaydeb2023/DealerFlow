'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api, fmtDateTime, useFetch } from '@/lib/df/client'
import { STAFF_ROLES, ROLE_LABEL } from '@/lib/df/constants'
import ResourcePage from '@/components/df/ResourcePage'
import FormModal from '@/components/df/FormModal'
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner, Table, Tabs, Td, Textarea } from '@/components/df/ui'

type Tab = 'company' | 'staff' | 'warehouses' | 'territories' | 'audit'

function Company() {
  const { data, reload } = useFetch<any>('/api/df/settings')
  const [v, setV] = useState<any>({}); const [busy, setBusy] = useState(false)
  useEffect(() => { if (data) setV(data.company) }, [data])
  if (!data) return <Spinner className="mx-auto my-8 h-6 w-6" />
  const set = (k: string, x: any) => setV((s: any) => ({ ...s, [k]: x }))
  const save = async () => { setBusy(true); try { await api('/api/df/settings', { method: 'PUT', body: { company: v } }); toast.success('Saved'); reload() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  const t = (k: string, l: string, extra?: any) => <Field label={l}><Input value={v[k] ?? ''} onChange={e => set(k, e.target.value)} {...extra} /></Field>
  const yn = (k: string, l: string, help: string) => <Field label={l} help={help}><Select value={v[k] === false ? '0' : '1'} onChange={e => set(k, e.target.value === '1')}><option value="1">On</option><option value="0">Off</option></Select></Field>
  return <div className="space-y-4">
    <Card title="Company and invoice details"><div className="grid gap-3 sm:grid-cols-2">{t('name', 'Company name')}{t('tagline', 'Tagline')}{t('gstin', 'GSTIN')}{t('state', 'State')}{t('phone', 'Phone')}{t('email', 'Email')}{t('upi_id', 'UPI ID')}{t('default_payment_terms_days', 'Default payment terms (days)', { type: 'number' })}
      <Field label="Address" ><Textarea rows={2} value={v.address ?? ''} onChange={e => set('address', e.target.value)} /></Field><Field label="Bank details (shown on invoices)"><Textarea rows={2} value={v.bank_details ?? ''} onChange={e => set('bank_details', e.target.value)} /></Field>
      <Field label="Invoice terms" ><Textarea rows={2} value={v.invoice_terms ?? ''} onChange={e => set('invoice_terms', e.target.value)} /></Field></div></Card>
    <Card title="Rules"><div className="grid gap-3 sm:grid-cols-3">{yn('require_credit_check', 'Credit limit check', 'Block approval when a dealer would go over their credit limit (admin can override)')}{yn('low_stock_alerts', 'Low-stock alerts', 'Notify managers when stock reaches the reorder level')}</div></Card>
    <Card title="Your plan"><p className="text-sm text-slate-600">Status: <Badge value={data.org.status} /> {data.org.plan ? `· ${data.org.plan}` : ''} {data.org.max_users ? `· up to ${data.org.max_users} users` : ''} {data.org.max_dealers ? `· up to ${data.org.max_dealers} dealers` : ''}</p></Card>
    <Button variant="primary" loading={busy} onClick={save}>Save settings</Button></div>
}

function Staff() {
  const { data, loading, error, reload } = useFetch<{ data: any[] }>('/api/df/staff')
  const [open, setOpen] = useState(false); const [pwd, setPwd] = useState<string | null>(null)
  const patch = async (id: string, body: any) => { try { const r: any = await api('/api/df/staff', { method: 'PATCH', body: { id, ...body } }); if (r.temp_password) setPwd(r.temp_password); reload() } catch (e: any) { toast.error(e.message) } }
  return <div className="space-y-3"><div className="flex justify-end"><Button variant="primary" onClick={() => setOpen(true)}>Add team member</Button></div>
    {error && <ErrorNote>{error}</ErrorNote>}
    {pwd && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">Temporary password (shown once): <b className="font-mono">{pwd}</b> <button className="ml-2 underline" onClick={() => setPwd(null)}>hide</button></div>}
    {loading && !data ? <Spinner className="mx-auto my-8 h-6 w-6" /> : <Table head={['Name', 'Email', 'Role', 'Active', '']}>{(data?.data || []).map(s => <tr key={s.id}><Td>{s.full_name}</Td><Td>{s.email}</Td>
      <Td><Select className="w-auto" value={s.role} onChange={e => patch(s.id, { role: e.target.value })}>{STAFF_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Td><Td><Badge value={s.active ? 'active' : 'inactive'} /></Td>
      <Td><div className="flex gap-2"><Button size="sm" onClick={() => patch(s.id, { active: !s.active })}>{s.active ? 'Deactivate' : 'Activate'}</Button><Button size="sm" onClick={() => confirm('Reset password?') && patch(s.id, { reset_password: true })}>Reset password</Button></div></Td></tr>)}</Table>}
    <FormModal open={open} onClose={() => setOpen(false)} title="Add team member" submitLabel="Create login" intro="Creates a login. If you leave the password empty, a temporary one is generated and shown once." fields={[{ key: 'full_name', label: 'Full name', required: true }, { key: 'email', label: 'Email', required: true }, { key: 'mobile', label: 'Mobile' }, { key: 'role', label: 'Role', type: 'select', options: STAFF_ROLES.map(r => ({ value: r, label: ROLE_LABEL[r] })), default: 'sales_rep' }, { key: 'password', label: 'Password (optional)' }]}
      onSubmit={async v => { const r: any = await api('/api/df/staff', { body: v }); if (r.temp_password) setPwd(r.temp_password); toast.success('Team member added'); reload() }} /></div>
}

function Audit() {
  const { data, error } = useFetch<{ data: any[] }>('/api/df/r/audit?limit=200')
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Spinner className="mx-auto my-8 h-6 w-6" />
  return <Table head={['When', 'Who', 'What', 'Action']}>{data.data.map(a => <tr key={a.id}><Td>{fmtDateTime(a.created_at)}</Td><Td>{a.actor_email || '-'}</Td><Td>{String(a.table_name).replace('df_', '')}</Td><Td>{a.action}</Td></tr>)}</Table>
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company')
  return <div><PageHeader title="Settings" subtitle="Company details, team, warehouses and territories" />
    <Tabs<Tab> tabs={[{ id: 'company', label: 'Company & rules' }, { id: 'staff', label: 'Team' }, { id: 'warehouses', label: 'Warehouses' }, { id: 'territories', label: 'Territories' }, { id: 'audit', label: 'Audit log' }]} value={tab} onChange={setTab} />
    {tab === 'company' && <Company />}{tab === 'staff' && <Staff />}{tab === 'audit' && <Audit />}
    {tab === 'warehouses' && <ResourcePage title="Warehouses" resource="warehouses" createLabel="Add warehouse" columns={[{ key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }, { key: 'address', label: 'Address' }, { key: 'active', label: 'Status', render: r => <Badge value={r.active ? 'active' : 'inactive'} /> }]} fields={[{ key: 'name', label: 'Name', required: true }, { key: 'code', label: 'Code' }, { key: 'address', label: 'Address', type: 'textarea' }, { key: 'active', label: 'Active', type: 'checkbox', default: true }]} />}
    {tab === 'territories' && <ResourcePage title="Territories" resource="territories" canDelete createLabel="Add territory" columns={[{ key: 'name', label: 'Territory' }, { key: 'region', label: 'Region' }]} fields={[{ key: 'name', label: 'Name', required: true }, { key: 'region', label: 'Region / state' }]} />}
  </div>
}
