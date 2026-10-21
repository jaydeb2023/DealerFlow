import { BRAND } from '@/lib/df/constants'

/** DealerFlow mark: an isometric cube in blue and cyan. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={BRAND.name}>
      <defs>
        <linearGradient id="dfa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1d4ed8" /><stop offset="1" stopColor="#0b1b46" /></linearGradient>
        <linearGradient id="dfb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22d3ee" /><stop offset="1" stopColor="#2563eb" /></linearGradient>
      </defs>
      <path d="M32 4 56 17.5v29L32 60 8 46.5v-29z" fill="url(#dfa)" />
      <path d="M32 4 56 17.5 32 31 8 17.5z" fill="url(#dfb)" />
      <path d="M32 31v29L8 46.5v-29z" fill="#1e40af" opacity=".55" />
      <path d="M32 31 56 17.5v29L32 60z" fill="#0b1b46" opacity=".35" />
      <path d="M22 25.5 32 31l10-5.5M32 31v12" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
    </svg>
  )
}

export default function Logo({ light = false, size = 34, tagline = false }: { light?: boolean; size?: number; tagline?: boolean }) {
  return (
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
}
