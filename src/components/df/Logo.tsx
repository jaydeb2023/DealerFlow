import Link from 'next/link'
import { BRAND } from '@/lib/df/constants'

/** DealerFlow mark (the supplied logo icon). */
export function LogoMark({ size = 36 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/dealerflow-mark.png" alt={BRAND.name} height={size} style={{ height: size, width: 'auto' }} />
}

/** Icon + wordmark. Clicking it opens the public home page. */
export default function Logo({ light = false, size = 34, tagline = false, home = true }: { light?: boolean; size?: number; tagline?: boolean; home?: boolean }) {
  const inner = (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <div className="leading-tight">
        <div className={`text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-df-900'}`}>
          DealerFlow <span className={light ? 'text-cyan-400' : 'text-df-600'}>AI</span>
        </div>
        {tagline && <div className={`text-[10px] uppercase tracking-[0.16em] ${light ? 'text-df-200' : 'text-slate-400'}`}>by {BRAND.maker}</div>}
      </div>
    </div>
  )
  return home ? <Link href="/" title="Go to home page" className="inline-block">{inner}</Link> : inner
}
