'use client';
import { ReactNode } from 'react';

/**
 * Realistic phone: brushed metal rim, black bezel, side buttons, Dynamic-Island style camera pill and a
 * real status bar. The app content starts BELOW the status bar / camera area, so nothing hides behind it.
 */
export function Phone_Frame({ children, dark = false, width = 280 }: { children: ReactNode; dark?: boolean; width?: number }) {
  const height = Math.round(width * 2.05);
  return (
    <div className="relative mx-auto" style={{ width, height }} aria-hidden="true">
      {/* side buttons */}
      <span className="absolute -left-[3px] top-[22%] h-10 w-[3px] rounded-l bg-gradient-to-b from-zinc-400 to-zinc-600" />
      <span className="absolute -left-[3px] top-[31%] h-14 w-[3px] rounded-l bg-gradient-to-b from-zinc-400 to-zinc-600" />
      <span className="absolute -right-[3px] top-[27%] h-20 w-[3px] rounded-r bg-gradient-to-b from-zinc-400 to-zinc-600" />
      {/* metal rim + bezel */}
      <div className="absolute inset-0 rounded-[48px] bg-gradient-to-br from-zinc-300 via-zinc-500 to-zinc-700 p-[2px] shadow-[0_40px_80px_-30px_rgba(11,37,69,0.55)]">
        <div className="h-full w-full rounded-[46px] bg-[#0a0a0c] p-[9px]">
          <div className={`relative flex h-full w-full flex-col overflow-hidden rounded-[38px] ${dark ? 'bg-ink text-white' : 'bg-paper text-ink'}`}>
            {/* status bar — the camera pill sits inside it, content starts after it */}
            <div className={`relative z-10 flex h-11 shrink-0 items-center justify-between px-6 text-[11px] font-semibold ${dark ? 'text-white' : 'text-ink'}`}>
              <span>9:41</span>
              <span className="absolute left-1/2 top-2.5 h-[26px] w-[86px] -translate-x-1/2 rounded-full bg-black" />
              <span className="flex items-center gap-1">
                <svg width="16" height="10" viewBox="0 0 16 10"><rect x="0" y="6" width="3" height="4" rx="1" fill="currentColor" /><rect x="4.3" y="4" width="3" height="6" rx="1" fill="currentColor" /><rect x="8.6" y="2" width="3" height="8" rx="1" fill="currentColor" /><rect x="12.9" y="0" width="3" height="10" rx="1" fill="currentColor" opacity=".35" /></svg>
                <svg width="22" height="11" viewBox="0 0 22 11"><rect x="0.5" y="0.5" width="19" height="10" rx="3" fill="none" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="13" height="7" rx="1.6" fill="currentColor" /><rect x="20.3" y="3.5" width="1.5" height="4" rx=".7" fill="currentColor" opacity=".45" /></svg>
              </span>
            </div>
            <div className="relative min-h-0 flex-1">{children}</div>
            {/* home indicator */}
            <div className="flex h-5 shrink-0 items-center justify-center"><span className={`h-1 w-24 rounded-full ${dark ? 'bg-white/70' : 'bg-ink/80'}`} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
