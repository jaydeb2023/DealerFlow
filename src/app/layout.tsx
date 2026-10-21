import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: 'DealerFlow AI by Evynta | Dealer & Distributor Management', template: '%s | DealerFlow AI' },
  description: 'Run your dealer network from one place: dealer ordering portal, inventory, dispatch, invoices, payments, sales team tracking and an AI business assistant. Built for Indian distributors, wholesalers and manufacturers.',
  openGraph: { title: 'DealerFlow AI by Evynta', description: 'Simplify Distribution. Accelerate Growth.', type: 'website' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      </body>
    </html>
  )
}
