'use client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { api } from '@/lib/df/client'
import InvoiceDoc from '@/components/df/InvoiceDoc'
import { useStaff } from '@/components/df/Context'

export default function Page({ params }: { params: { id: string } }) {
  const router = useRouter(); const me = useStaff()
  const voidIt = async () => { if (!confirm('Void this invoice? The order can then be invoiced again.')) return; try { await api(`/api/df/invoices/${params.id}`, { method: 'DELETE' }); toast.success('Invoice voided'); router.refresh(); router.push('/app/invoices') } catch (e: any) { toast.error(e.message) } }
  return <InvoiceDoc id={params.id} onVoid={me.role === 'finance' || me.role === 'admin' ? voidIt : undefined} />
}
