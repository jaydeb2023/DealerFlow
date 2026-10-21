'use client'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/df/ui'
import OrderBuilder from '@/components/df/OrderBuilder'
import { useStaff } from '@/components/df/Context'

export default function PortalHome() {
  const router = useRouter(); const me = useStaff()
  return <div><PageHeader title="Place an order" subtitle="Prices shown are your dealer prices. Your order goes to the distributor for approval." />
    <OrderBuilder isDealer canDiscount={false} onDone={r => router.push(`/app/portal/orders/${r.id}`)} />{me.role !== 'dealer' ? null : null}</div>
}
