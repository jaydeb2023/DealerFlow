'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import InvoiceDoc from '@/components/df/InvoiceDoc'
function Inner() { const id = useSearchParams().get('id'); return id ? <InvoiceDoc id={id} /> : null }
export default function Page() { return <Suspense><Inner /></Suspense> }
