import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BarChart3, Bell, Boxes, Check, ClipboardList, Hammer, HeartPulse, MessageCircle, Plug, ShoppingBag, Sparkles, Store, Truck, Users, Wallet, Zap } from 'lucide-react'
import Logo, { LogoMark } from '@/components/df/Logo'
import DemoForm from '@/components/site/DemoForm'

const FEATURES = [
  { icon: Users, t: 'Dealer Management', d: 'Manage dealers, regions, pricing and credit limits.' },
  { icon: ClipboardList, t: 'Digital Catalogue', d: 'Show product catalogue with dealer-specific prices.' },
  { icon: ShoppingBag, t: 'Order Management', d: 'Receive, approve and track orders from dealers and your sales team.' },
  { icon: Boxes, t: 'Inventory Tracking', d: 'Real-time stock by warehouse, with no silent overselling.' },
  { icon: Wallet, t: 'Payment & Credit', d: 'Track outstanding, receipts and credit limits.' },
  { icon: Truck, t: 'Sales Team App', d: 'Field reps log visits, calls and follow-ups from their phone.' },
  { icon: BarChart3, t: 'Reports & Analytics', d: 'Sales, dealer, stock and ageing reports with Excel export.' },
  { icon: Sparkles, t: 'AI Assistant', d: 'Ask questions in plain words, answered from your real records.' },
]
const INDUSTRIES = [
  { icon: Hammer, t: 'Building Materials', d: 'Cement, Steel, Pipes, Hardware' }, { icon: ShoppingBag, t: 'FMCG Distribution', d: 'Food, Beverages, Consumer Goods' },
  { icon: Plug, t: 'Electrical & Hardware', d: 'Cables, Switches, Industrial Supplies' }, { icon: Store, t: 'Industrial Products', d: 'Machinery, Tools, Components' }, { icon: HeartPulse, t: 'Pharma & Healthcare', d: 'Medicines, Medical Supplies' },
]
const STEPS = [
  { t: 'Setup Your Business', d: 'Add products, dealers and pricing.' }, { t: 'Invite Dealers', d: 'Dealers log in to their own portal.' },
  { t: 'Manage Orders', d: 'Approve, pick, dispatch and invoice.' }, { t: 'Grow Your Sales', d: 'Get insights and collect faster.' },
]
const PLANS = [
  { n: 'Starter', p: '₹4,999', d: 'For smaller distributors', f: ['Dealer, product and order management', 'Dealer ordering portal', 'Invoices and payments', 'Email support'] },
  { n: 'Growth', p: '₹9,999', d: 'For growing businesses', hot: true, f: ['Everything in Starter', 'Inventory with multiple warehouses', 'Reports and Excel export', 'Sales team tracking and AI assistant', 'More users'] },
  { n: 'Business', p: '₹19,999+', d: 'For larger workflows', f: ['Everything in Growth', 'Advanced permissions', 'Agreed integrations', 'Priority support'] },
]

function Preview() {
  const bars = [30, 42, 36, 55, 48, 62, 58, 74, 66, 82, 78, 94]
  return <div className="relative mx-auto w-full max-w-xl">
    <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-cyan-300/40 via-df-200/40 to-transparent blur-2xl" />
    <div className="relative overflow-hidden rounded-2xl border border-df-100 bg-white shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2"><span className="h-2.5 w-2.5 rounded-full bg-red-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" /><span className="ml-3 text-[10px] text-slate-400">DealerFlow AI · Dashboard</span></div>
      <div className="grid grid-cols-[110px_1fr]">
        <div className="space-y-1.5 bg-df-900 p-3 text-[10px] text-df-100">{['Dashboard', 'Orders', 'Dealers', 'Products', 'Inventory', 'Payments', 'Reports', 'AI Assistant'].map((x, i) => <div key={x} className={`rounded px-2 py-1.5 ${i === 0 ? 'bg-df-600 font-semibold text-white' : ''}`}>{x}</div>)}</div>
        <div className="p-3">
          <div className="grid grid-cols-3 gap-2 text-center">{[['Total sales', '₹12.4L'], ['Orders', '247'], ['Dealers', '86']].map(([a, b]) => <div key={a} className="rounded-lg border border-slate-100 p-2"><div className="text-sm font-bold text-df-800">{b}</div><div className="text-[9px] text-slate-500">{a}</div></div>)}</div>
          <div className="mt-3 flex h-24 items-end gap-1 rounded-lg border border-slate-100 p-2">{bars.map((h, i) => <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-df-600 to-cyan-400" style={{ height: `${h}%` }} />)}</div>
          <div className="mt-2 space-y-1 text-[10px]">{[['ORD-1001', 'Processing'], ['ORD-1000', 'Delivered'], ['ORD-0999', 'Dispatched']].map(([a, b]) => <div key={a} className="flex justify-between rounded bg-slate-50 px-2 py-1"><span>{a}</span><span className="text-slate-500">{b}</span></div>)}</div>
        </div>
      </div>
    </div>
    <div className="absolute -left-4 top-10 hidden items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-xl sm:flex"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white"><MessageCircle className="h-4 w-4" /></span><div className="text-[11px] leading-tight"><b>New order</b><br /><span className="text-slate-500">from a dealer</span></div></div>
    <div className="absolute -right-3 bottom-10 hidden items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-xl sm:flex"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600"><Bell className="h-4 w-4" /></span><div className="text-[11px] leading-tight"><b>Low stock alert</b><br /><span className="text-slate-500">reorder level reached</span></div></div>
    <p className="mt-3 text-center text-[11px] text-slate-400">Illustration with sample figures</p>
  </div>
}

export default function Home() {
  return <div className="bg-white text-slate-800">
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3"><Image src="/evynta-logo-dark.png" alt="Evynta" width={96} height={30} className="hidden h-7 w-auto sm:block" /><span className="hidden h-6 w-px bg-slate-200 sm:block" /><Logo size={30} /></Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">{[['Features', '#features'], ['Industries', '#industries'], ['How it works', '#how'], ['Pricing', '#pricing'], ['Contact', '#demo']].map(([l, h]) => <a key={l} href={h} className="hover:text-df-700">{l}</a>)}</nav>
        <div className="flex items-center gap-2"><Link href="/app/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Login</Link><a href="#demo" className="rounded-lg bg-df-700 px-4 py-2 text-sm font-semibold text-white hover:bg-df-800">Request a Demo</a></div>
      </div></header>

    <section className="relative overflow-hidden bg-gradient-to-br from-df-50 via-white to-cyan-50">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
        <div>
          <div className="flex items-center gap-4"><LogoMark size={64} /><h1 className="text-5xl font-extrabold tracking-tight text-df-900 sm:text-6xl">DealerFlow <span className="text-df-600">AI</span></h1></div>
          <h2 className="mt-5 text-2xl font-bold leading-snug text-df-900">Simplify Distributor &amp; Dealer Management with AI and Automation</h2>
          <p className="mt-3 max-w-xl text-slate-600">Manage your dealers, orders, inventory, payments and sales team in one powerful platform. Built for manufacturers, wholesalers and distributors in India and global markets.</p>
          <div className="mt-7 flex flex-wrap gap-3"><a href="#demo" className="inline-flex items-center gap-2 rounded-lg bg-df-700 px-6 py-3 font-semibold text-white shadow-lg shadow-df-700/25 hover:bg-df-800">Get a Free Demo <ArrowRight className="h-4 w-4" /></a><a href="#how" className="inline-flex items-center gap-2 rounded-lg border-2 border-df-600 px-6 py-3 font-semibold text-df-700 hover:bg-df-50">See How It Works</a></div>
          <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">{[[ShoppingBag, 'Dealer Ordering'], [Boxes, 'Inventory Management'], [MessageCircle, 'WhatsApp-ready alerts'], [Users, 'Sales Team Tracking']].map(([I, l]: any) => <div key={l} className="flex items-center gap-3 rounded-xl border border-df-100 bg-white p-3 shadow-sm"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-df-50 text-df-600"><I className="h-5 w-5" /></span><span className="text-sm font-semibold text-slate-700">{l}</span></div>)}</div>
        </div>
        <Preview />
      </div></section>

    <section id="features" className="mx-auto max-w-7xl px-4 py-16">
      <h2 className="text-3xl font-bold text-df-900">Why Choose DealerFlow AI</h2><p className="mt-2 text-slate-600">Everything you need to run your distribution business, from order to payment.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{FEATURES.map(({ icon: I, t, d }) => <div key={t} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-df-50 text-df-600"><I className="h-6 w-6" /></span><h3 className="mt-4 font-bold text-df-900">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div>)}</div></section>

    <section id="industries" className="bg-slate-50 py-16"><div className="mx-auto max-w-7xl px-4">
      <h2 className="text-3xl font-bold text-df-900">Built for Your Industry</h2><p className="mt-2 text-slate-600">Designed for distributors, wholesalers and manufacturers across industries.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{INDUSTRIES.map(({ icon: I, t, d }) => <div key={t} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"><div className="flex h-28 items-center justify-center bg-gradient-to-br from-df-700 to-cyan-500 text-white"><I className="h-12 w-12" /></div><div className="p-4"><h3 className="font-bold text-df-900">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p></div></div>)}</div></div></section>

    <section id="how" className="mx-auto max-w-7xl px-4 py-16">
      <h2 className="text-3xl font-bold text-df-900">How DealerFlow AI Works</h2><p className="mt-2 text-slate-600">Get started in just a few simple steps.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-4">{STEPS.map((s, i) => <div key={s.t} className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-df-600 text-lg font-bold text-white">{i + 1}</span><h3 className="mt-3 font-bold text-df-900">{s.t}</h3><p className="mt-1 text-sm text-slate-600">{s.d}</p>{i < 3 && <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-df-300 md:block" />}</div>)}</div></section>

    <section id="pricing" className="bg-slate-50 py-16"><div className="mx-auto max-w-7xl px-4">
      <h2 className="text-3xl font-bold text-df-900">Simple, affordable pricing</h2><p className="mt-2 text-slate-600">Per month, per company. Plus a one-time onboarding and data setup of ₹20,000 to ₹75,000 depending on migration and integrations. Introductory pricing; confirmed at your demo.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">{PLANS.map(p => <div key={p.n} className={`rounded-2xl border bg-white p-6 shadow-sm ${p.hot ? 'border-df-600 ring-2 ring-df-600' : 'border-slate-100'}`}>{p.hot && <div className="mb-2 inline-block rounded-full bg-df-600 px-2.5 py-0.5 text-xs font-semibold text-white">Most popular</div>}<h3 className="text-lg font-bold text-df-900">{p.n}</h3><div className="mt-1 text-3xl font-extrabold text-df-700">{p.p}<span className="text-sm font-medium text-slate-500"> /month</span></div><p className="text-sm text-slate-500">{p.d}</p>
        <ul className="mt-4 space-y-2 text-sm">{p.f.map(x => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{x}</li>)}</ul><a href="#demo" className="mt-5 block rounded-lg border border-df-600 px-4 py-2 text-center text-sm font-semibold text-df-700 hover:bg-df-50">Talk to us</a></div>)}</div></div></section>

    <section id="demo" className="bg-gradient-to-br from-df-950 via-df-900 to-df-700 py-16 text-white"><div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
      <div><h2 className="text-3xl font-bold">Ready to Simplify Your Distribution Business?</h2><p className="mt-3 text-df-100">Tell us about your business and we will show you DealerFlow AI working with your kind of products and dealers.</p>
        <ul className="mt-5 space-y-2 text-sm text-df-100">{['Quick setup with Excel import', 'Affordable monthly pricing', 'Dedicated onboarding support', 'Customisable for your business'].map(x => <li key={x} className="flex gap-2"><Zap className="h-4 w-4 text-cyan-400" />{x}</li>)}</ul></div>
      <DemoForm /></div></section>

    <footer className="bg-df-950 py-10 text-df-200"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4">
      <div className="flex items-center gap-4"><Image src="/evynta-logo-light.png" alt="Evynta" width={110} height={34} className="h-8 w-auto" /><div className="text-sm"><b className="text-white">DealerFlow AI</b><br />A product of Evynta · Built for modern distribution</div></div>
      <div className="flex gap-5 text-sm"><a href="#features" className="hover:text-white">Features</a><a href="#pricing" className="hover:text-white">Pricing</a><Link href="/app/login" className="hover:text-white">Login</Link></div>
      <div className="w-full text-xs text-df-300">© {new Date().getFullYear()} Evynta. All rights reserved.</div></div></footer>
  </div>
}
