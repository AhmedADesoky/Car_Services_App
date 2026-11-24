'use client';
import type { LucideIcon } from 'lucide-react';

/**
 * "Invisible" icon style: no solid tile — a thin outline glyph inside a hairline ring with a faint
 * inner glow. On hover (when inside a `group`) the ring warms to amber and the glyph lifts slightly.
 */
export function Glyph({ icon: Icon, size = 44, tone = 'light', active = false }: { icon: LucideIcon; size?: number; tone?: 'light' | 'dark'; active?: boolean }) {
  const dark = tone === 'dark';
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full transition-all duration-500 group-hover:-translate-y-0.5 ${
        dark ? 'text-glow' : 'text-teal'
      } ${active ? (dark ? 'text-amber' : 'text-navy') : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className={`absolute inset-0 rounded-full border transition-colors duration-500 ${
          dark ? 'border-white/15 group-hover:border-amber/60' : 'border-navy/10 group-hover:border-amber/70'
        } ${active ? (dark ? '!border-amber/60' : '!border-teal/50') : ''}`}
      />
      <span
        className={`absolute inset-[3px] rounded-full opacity-60 transition-opacity duration-500 group-hover:opacity-100 ${
          dark ? 'bg-[radial-gradient(circle_at_30%_25%,rgba(127,211,207,0.18),transparent_65%)]' : 'bg-[radial-gradient(circle_at_30%_25%,rgba(14,138,134,0.10),transparent_65%)]'
        }`}
      />
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.4} className="relative" />
    </span>
  );
}
