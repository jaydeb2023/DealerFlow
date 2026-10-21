'use client'
import OrderView from '@/components/df/OrderView'
export default function Page({ params }: { params: { id: string } }) { return <OrderView id={params.id} portal /> }
