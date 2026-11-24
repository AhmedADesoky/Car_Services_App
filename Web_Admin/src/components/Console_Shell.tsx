'use client';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { Activity, Building2, ClipboardList, Gauge, KeyRound, LogOut, Menu, ScrollText, Users, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, ReactNode, useContext, useState } from 'react';
import { Brand_Mark } from './Brand_Mark';
import { useApi } from '@/lib/Use_Api';

export interface Me {
  id: string; email: string; fullName: string; department: string | null; roles: string[]; permissions: string[];
}

const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext);
export const can = (me: Me | null, permission: string) => !!me?.permissions.includes(permission);

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge, permission: 'dashboard.view' },
  { href: '/requests', label: 'Station requests', icon: ClipboardList, permission: 'requests.view' },
  { href: '/stations', label: 'Stations', icon: Building2, permission: 'stations.view' },
  { href: '/plans', label: 'Plans & billing', icon: Wallet, permission: 'stations.view' },
  { href: '/team', label: 'Team', icon: Users, permission: 'team.view' },
  { href: '/roles', label: 'Roles & access', icon: KeyRound, permission: 'team.view' },
  { href: '/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.view' },
];

function Nav({ me, onNavigate }: { me: Me | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.filter((item) => can(me, item.permission)).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}
            className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm transition-colors duration-300 ${active ? 'font-semibold text-white' : 'font-medium text-mist/80 hover:text-white'}`}>
            {active && (
              <>
                {/* "invisible" indicator: a soft wash + a thin glowing edge line, no box */}
                <motion.span layoutId="nav-active-wash" className="absolute inset-0 rounded-xl bg-gradient-to-r from-glow/[0.09] to-transparent"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                <motion.span layoutId="nav-active-line" className="absolute inset-y-2.5 left-0 w-[2px] rounded-full bg-glow shadow-[0_0_12px_2px_rgba(127,211,207,0.6)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
              </>
            )}
            <Icon size={18} className={`relative transition-colors duration-300 ${active ? 'text-glow' : 'group-hover:text-glow/80'}`} aria-hidden="true" />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Console_Shell({ children }: { children: ReactNode }) {
  const { data: me } = useApi<Me>('auth/me');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-8 p-5">
      <Brand_Mark />
      <Nav me={me} onNavigate={() => setOpen(false)} />
      <div className="mt-auto rounded-2xl bg-white/[0.025] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-glow/15 font-display font-bold text-glow">
            {(me?.fullName ?? '··').split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{me?.fullName ?? '...'}</div>
            <div className="truncate text-xs text-mist">{me?.roles.join(', ')}</div>
          </div>
        </div>
        <button onClick={signOut} className="btn btn-ghost mt-3 w-full text-sm"><LogOut size={16} /> Sign out</button>
      </div>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <MeContext.Provider value={me}>
        <div className="grid-backdrop min-h-screen">
          {/* floating glass sidebar: no hard border, it hovers over the grid */}
          <aside className="fixed inset-y-3 left-3 hidden w-[264px] rounded-[28px] bg-gradient-to-b from-white/[0.045] to-white/[0.015] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.06] backdrop-blur-xl lg:block">{sidebar}</aside>
          <header className="sticky top-3 z-30 mx-3 flex items-center justify-between rounded-full bg-deep/70 px-3 py-2 ring-1 ring-white/[0.06] backdrop-blur-xl lg:hidden">
            <Brand_Mark compact />
            <button className="flex h-10 w-10 items-center justify-center rounded-full text-fog hover:bg-white/5" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
          </header>
          <AnimatePresence>
            {open && (
              <motion.div className="fixed inset-0 z-40 bg-ink/70 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
                <motion.aside className="h-full w-72 rounded-e-[28px] bg-deep ring-1 ring-white/[0.06]" initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 36 }} onClick={(e) => e.stopPropagation()}>
                  <button className="absolute right-3 top-3 p-2 text-mist" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
                  {sidebar}
                </motion.aside>
              </motion.div>
            )}
          </AnimatePresence>
          <main className="lg:pl-[284px]">
            <AnimatePresence mode="wait">
              <motion.div key={pathname} className="mx-auto max-w-7xl px-4 py-8 sm:px-8"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}>
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
          <div className="pointer-events-none fixed bottom-4 right-4 hidden items-center gap-2 rounded-full border border-line bg-deep/80 px-3 py-1.5 text-[11px] text-mist lg:flex">
            <Activity size={12} className="text-glow" /> Staff only · every action is audited
          </div>
        </div>
      </MeContext.Provider>
    </MotionConfig>
  );
}
