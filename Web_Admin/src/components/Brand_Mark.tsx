import { BRAND } from '@/config/Brand_Config';

/** Brand glyph: a crescent "gear" with a scan spark (same language as the mobile Sign in artwork). */
export function Brand_Glyph({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#F2B544" />
      <path d="M20 8a12 12 0 1 0 8.5 20.5A9.3 9.3 0 0 1 20 8z" fill="#0B2545" />
      <path d="M26.5 11.5l1.2 2.4 2.4 1.2-2.4 1.2-1.2 2.4-1.2-2.4-2.4-1.2 2.4-1.2z" fill="#0B2545" />
    </svg>
  );
}

export function Brand_Mark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Brand_Glyph />
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-[17px] font-bold text-white">{BRAND.name}</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-mist">{BRAND.tagline}</div>
        </div>
      )}
    </div>
  );
}
