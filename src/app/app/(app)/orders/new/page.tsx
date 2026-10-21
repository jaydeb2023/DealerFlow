'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useFetch } from '@/lib/df/client'
import { PageHeader, Field, Select, Card } from '@/components/df/ui'
import OrderBuilder from '@/components/df/OrderBuilder'
import { useStaff } from '@/components/df/Context'

function Inner() {
  const router = useRouter(); const sp = useSearchParams(); const me = useStaff()
  const [dealer, setDealer] = useState(sp.get('dealer_id') || '')
  const { data } = useFetch<{ data: any[] }>('/api/df/dealers/overview?status=active')
  return <div>
    <PageHeader title="New order" subtitle="Choose the dealer; prices follow their price list" />
    <Card className="mb-4"><Field label="Dealer"><Select value={dealer} onChange={e => setDealer(e.target.value)}><option value="">Select dealer...</option>{(data?.data || []).map(d => <option key={d.id} value={d.id}>{d.name} ({d.dealer_code})</option>)}</Select></Field></Card>
    <OrderBuilder dealerId={dealer || undefined} isDealer={false} canDiscount={me.role === 'admin' || me.role === 'sales_manager'} onDone={r => router.push(`/app/orders/${r.id}`)} />
  </div>
}
export default function Page() { return <Suspense><Inner /></Suspense> }
