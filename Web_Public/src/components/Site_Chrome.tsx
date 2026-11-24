'use client';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { ArrowRight, Globe, Menu, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { BRAND, Locale } from '@/config/Brand_Config';
import type { Dictionary } from '@/i18n/Dictionary';

export function Brand_Glyph({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#F2B544" />
      <path d="M20 8a12 12 0 1 0 8.5 20.5A9.3 9.3 0 0 1 20 8z" fill="#0B2545" />
      <path d="M26.5 11.5l1.2 2.4 2.4 1.2-2.4 1.2-1.2 2.4-1.2-2.4-2.4-1.2 2.4-1.2z" fill="#0B2545" />
    </svg>
  );
}

export function Site_Header({ t, locale }: { t: Dictionary; locale: Locale }) {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setSolid(y > 40));
  const other = locale === 'ar' ? 'en' : 'ar';
  const [hovered, setHovered] = useState<string | null>(null);
  const links: [string, string][] = [['#how', t.nav.how], ['#features', t.nav.features], ['#security', t.nav.security], ['#plans', t.nav.plans], ['#assistant', t.nav.faq]];

  return (
    <motion.header className="pointer-events-none fixed inset-x-0 top-3 z-50 px-3 sm:top-4"
      initial={{ y: -90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 26 }}>
      {/* "Invisible" floating capsule: glass + hairline, no solid bar */}
      <motion.div
        animate={{
          backgroundColor: solid ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.05)',
          borderColor: solid ? 'rgba(11,37,69,0.08)' : 'rgba(255,255,255,0.12)',
          boxShadow: solid ? '0 18px 40px -24px rgba(11,37,69,0.35)' : '0 0 0 rgba(0,0,0,0)',
          maxWidth: solid ? 1040 : 1180,
        }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        className={`pointer-events-auto mx-auto flex h-14 items-center justify-between gap-3 rounded-full border ps-2 pe-2 backdrop-blur-xl ${solid ? 'text-ink' : 'text-white'}`}>
        <Link href={`/${locale}`} className="flex items-center gap-2.5 ps-1" aria-label={BRAND.name}>
          <Brand_Glyph size={32} /><span className="font-display text-[15px] font-bold">{locale === 'ar' ? BRAND.nameAr : BRAND.name}</span>
        </Link>
        <nav className="hidden items-center text-[13px] font-semibold lg:flex" aria-label="Main" onMouseLeave={() => setHovered(null)}>
          {links.map(([href, label]) => (
            <a key={href} href={href} onMouseEnter={() => setHovered(href)} className="relative rounded-full px-4 py-2 opacity-75 transition-opacity hover:opacity-100">
              {hovered === href && (
                <motion.span layoutId="nav-hover" className={`absolute inset-0 rounded-full ${solid ? 'bg-navy/[0.06]' : 'bg-white/10'}`}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
              )}
              <span className="relative">{label}</span>
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link href={`/${other}`} onClick={() => { document.cookie = `locale=${other};path=/;max-age=31536000;samesite=lax`; }}
            className="hidden h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold opacity-80 transition-opacity hover:opacity-100 sm:flex"><Globe size={15} strokeWidth={1.5} />{t.nav.lang}</Link>
          <a href="#request" className="hidden h-10 items-center rounded-full bg-amber px-5 text-[13px] font-bold text-navy transition-transform hover:scale-[1.03] sm:inline-flex">{t.nav.cta}</a>
          <button className="flex h-10 w-10 items-center justify-center rounded-full lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={20} strokeWidth={1.5} /></button>
        </div>
      </motion.div>
      <AnimatePresence>
        {open && (
          <motion.div className="pointer-events-auto fixed inset-0 z-50 bg-navy/95 p-6 text-white backdrop-blur lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute end-5 top-5 flex h-11 w-11 items-center justify-center" onClick={() => setOpen(false)} aria-label="Close"><X /></button>
            <motion.nav className="mt-16 flex flex-col gap-2" initial="h" animate="s" variants={{ h: {}, s: { transition: { staggerChildren: 0.05 } } }}>
              {[...links, [`/${other}`, t.nav.lang] as [string, string]].map(([href, label]) => (
                <motion.a key={href} href={href} onClick={() => setOpen(false)} variants={{ h: { opacity: 0, y: 12 }, s: { opacity: 1, y: 0 } }}
                  className="rounded-2xl px-2 py-3 font-display text-3xl font-bold">{label}</motion.a>
              ))}
              <motion.a href="#request" onClick={() => setOpen(false)} variants={{ h: { opacity: 0 }, s: { opacity: 1 } }} className="btn btn-amber mt-6">{t.nav.cta}</motion.a>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

export function Site_Footer({ t, locale }: { t: Dictionary; locale: Locale }) {
  const other = locale === 'ar' ? 'en' : 'ar';
  const columns: { title: string; links: [string, string][] }[] = [
    { title: t.footer.product, links: [['#how', t.nav.how], ['#features', t.nav.features], ['#security', t.nav.security], ['#plans', t.nav.plans]] },
    { title: t.footer.company, links: [['#request', t.nav.cta], ['#assistant', t.footer.ask], [`mailto:${BRAND.contactEmail}`, BRAND.contactEmail]] },
    { title: t.footer.legal, links: [['#', t.footer.privacy], ['#', t.footer.terms]] },
  ];
  return (
    <footer className="relative overflow-hidden bg-deep text-white/70">
      <div className="pointer-events-none absolute -top-40 start-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-teal/15 blur-[120px] rtl:translate-x-1/2" />

      {/* call-to-action band */}
      <div className="relative mx-auto max-w-7xl px-5 pt-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0f3460] via-navy to-[#0a2a3f] p-8 ring-1 ring-white/10 sm:p-12">
            <motion.div className="pointer-events-none absolute -end-20 -top-24 h-72 w-72 rounded-full bg-amber/20 blur-3xl"
              animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
            <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
            <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <h2 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl">{t.footer.ctaTitle}</h2>
                <p className="mt-3 text-white/65">{t.footer.ctaText}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="#request" className="btn btn-amber group">{t.nav.cta}<ArrowRight size={18} className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" /></a>
                <a href="#assistant" className="btn border border-white/20 text-white hover:bg-white/5"><Sparkles size={17} className="text-amber" />{t.footer.ask}</a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* brand + columns */}
      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-10 pt-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3"><Brand_Glyph size={40} /><span className="font-display text-xl font-bold text-white">{locale === 'ar' ? BRAND.nameAr : BRAND.name}</span></div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed">{t.footer.staff}</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-xs ring-1 ring-white/10">
            <span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-glow/60" /><span className="relative h-2 w-2 rounded-full bg-glow" /></span>{t.footer.status}
          </span>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-glow/80">{col.title}</div>
            <ul className="mt-4 space-y-3 text-sm">
              {col.links.map(([href, label]) => (
                <li key={label}>
                  <a href={href} className="group relative inline-flex items-center gap-1.5 transition-colors hover:text-white">
                    <span className="h-px w-0 bg-amber transition-all duration-300 group-hover:w-3" />{label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* bottom bar */}
      <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 border-t border-white/[0.07] px-5 py-6 text-xs sm:flex-row sm:items-center">
        <span>© {new Date().getFullYear()} {BRAND.name}. {t.footer.rights} · {t.footer.made}</span>
        <Link href={`/${other}`} onClick={() => { document.cookie = `locale=${other};path=/;max-age=31536000;samesite=lax`; }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ring-white/10 transition-colors hover:text-white hover:ring-white/25"><Globe size={14} strokeWidth={1.5} />{t.nav.lang}</Link>
      </div>

      {/* oversized outlined wordmark */}
      <div aria-hidden="true" className="pointer-events-none relative -mb-[3vw] select-none overflow-hidden text-center font-display text-[17vw] font-bold leading-none tracking-tight text-transparent [-webkit-text-stroke:1px_rgba(127,211,207,0.14)]">
        {BRAND.name}
      </div>
    </footer>
  );
}

export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0, 0, 1] }}>
      {children}
    </motion.div>
  );
}
