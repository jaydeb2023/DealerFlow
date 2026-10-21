'use client'
import React, { useEffect } from 'react'
import { Loader2, X } from 'lucide-react'
import { STATUS_COLOR, labelize } from '@/lib/df/constants'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('animate-spin text-df-600', className || 'h-5 w-5')} />
}

export function Badge({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-gray-400">-</span>
  return (
    <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLOR[value] || 'bg-gray-100 text-gray-700', className)}>
      {labelize(value)}
    </span>
  )
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md'; loading?: boolean }
export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-df-700 text-white hover:bg-df-800 border-transparent',
    secondary: 'bg-white text-gray-800 hover:bg-gray-50 border-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 border-transparent',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 border-transparent',
  }[variant]
  const s = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-50', v, s, className)}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  )
}

const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-df-500 focus:outline-none focus:ring-2 focus:ring-df-200 disabled:bg-gray-50'
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cx(inputCls, className)} />
})
export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, className)}>{children}</select>
}
export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={cx(inputCls, className)} />
}

export function Field({ label, help, required, children, className }: { label: string; help?: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-gray-400">{help}</span>}
    </label>
  )
}

export function Card({ title, actions, children, className, pad = true }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('rounded-xl border border-gray-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-8" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={cx('w-full rounded-2xl bg-white shadow-xl', wide ? 'max-w-3xl' : 'max-w-xl')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">{children}</div>
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</div>
}

export function Stat({ label, value, hint, tone, href }: { label: string; value: React.ReactNode; hint?: string; tone?: 'warn' | 'bad' | 'good'; href?: string }) {
  const color = tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : tone === 'good' ? 'text-emerald-600' : 'text-gray-900'
  const inner = (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-df-300">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className={cx('mt-1 text-2xl font-bold', color)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-400">{hint}</div>}
    </div>
  )
  return href ? <a href={href}>{inner}</a> : inner
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx('whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition', value === t.id ? 'border-df-700 text-df-800' : 'border-transparent text-gray-500 hover:text-gray-800')}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Plain responsive table wrapper. */
export function Table({ head, children, className }: { head: React.ReactNode[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('overflow-x-auto rounded-lg border border-gray-200 bg-white', className)}>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  )
}
export const Td = ({ children, className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td {...p} className={cx('px-3 py-2 align-top text-gray-800', className)}>{children}</td>
