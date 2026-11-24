'use client';
import { AnimatePresence, motion, MotionConfig, MotionValue, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { ArrowDown, ArrowRight, BarChart3, Camera, Car, Check, FileSpreadsheet, MessageCircle, ScanLine, ShieldCheck, Users, WifiOff } from 'lucide-react';
import { MouseEvent, useRef, useState } from 'react';
import type { Dictionary } from '@/i18n/Dictionary';
import { Glyph } from './Glyph';
import { Phone_Frame } from './Phone_Frame';
import { Plate_Scan_Visual } from './Plate_Scan_Visual';
import { Brand_Glyph, Reveal } from './Site_Chrome';

const ease = [0.2, 0, 0, 1] as const;

/* ------------------------------------------------------------------ HERO */
export function Hero({ t }: { t: Dictionary }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return (
    <MotionConfig reducedMotion="user">
      <section ref={ref} className="relative overflow-hidden bg-navy pb-32 pt-32 text-white sm:pt-40">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:56px_56px]" />
        <motion.div className="pointer-events-none absolute -top-40 end-[-10%] h-[520px] w-[520px] rounded-full bg-teal/40 blur-[120px]"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.75, 0.5] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="pointer-events-none absolute bottom-[-30%] start-[-10%] h-[420px] w-[420px] rounded-full bg-amber/25 blur-[120px]"
          animate={{ scale: [1.1, 1, 1.1] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }} />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 lg:grid-cols-[1.15fr_1fr]">
          <motion.div style={{ y, opacity: fade }}>
            <motion.p className="eyebrow !text-glow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ease }}>{t.hero.eyebrow}</motion.p>
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
              {[t.hero.title1, t.hero.title2].map((line, i) => (
                <span key={line} className="block overflow-hidden pb-2">
                  <motion.span className={`block ${i === 1 ? 'text-amber' : ''}`} initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 0.9, delay: 0.25 + i * 0.12, ease }}>{line}</motion.span>
                </span>
              ))}
            </h1>
            <motion.p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.8 }}>{t.hero.text}</motion.p>
            <motion.div className="mt-9 flex flex-wrap gap-3" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, ease }}>
              <a href="#request" className="btn btn-amber group">{t.hero.primary}<ArrowRight size={18} className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" /></a>
              <a href="#how" className="btn btn-light">{t.hero.secondary}<ArrowDown size={18} /></a>
            </motion.div>
            <motion.ul className="mt-10 flex flex-wrap gap-2" initial="h" animate="s" variants={{ h: {}, s: { transition: { staggerChildren: 0.08, delayChildren: 0.9 } } }}>
              {t.hero.chips.map((c) => (
                <motion.li key={c} variants={{ h: { opacity: 0, scale: 0.9 }, s: { opacity: 1, scale: 1 } }} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm text-white/80">
                  <Check size={14} className="text-glow" />{c}
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.92, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 1, delay: 0.3, ease }}>
            <Plate_Scan_Visual labels={t.hero} />
          </motion.div>
        </div>
        {/* curved bottom edge into the paper sections */}
        <svg className="absolute bottom-0 left-0 w-full text-paper" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true"><path d="M0 80h1440V0C1140 60 300 60 0 0z" fill="currentColor" /></svg>
      </section>
    </MotionConfig>
  );
}

/* ------------------------------------------------------------------ HOW A CAR MOVES (scroll story) */
const STEP_ICONS = [ScanLine, Car, Check, MessageCircle];

function App_Bar({ title, sub, dark = false }: { title: string; sub?: string; dark?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 pb-2 pt-1 ${dark ? 'text-white' : 'text-ink'}`}>
      <div><div className={`text-[10px] ${dark ? 'text-white/55' : 'text-mist'}`}>{sub}</div><div className="font-display text-[15px] font-bold">{title}</div></div>
      <span className={`h-7 w-7 rounded-full border ${dark ? 'border-white/20' : 'border-navy/15'}`} />
    </div>
  );
}

/** Step 4: WhatsApp Business chat with a real-looking Arabic tax receipt. */
function Whatsapp_Receipt() {
  const rows: [string, string][] = [['تغيير زيت + فلتر', '٧٠٠٫٠٠'], ['تيل فرامل أمامي', '١٬٢٠٠٫٠٠'], ['ضريبة القيمة المضافة ١٤٪', '٢٦٦٫٠٠']];
  return (
    <div dir="rtl" className="flex h-full flex-col bg-[#efeae2] font-arabic">
      {/* WhatsApp header */}
      <div className="flex items-center gap-2.5 bg-[#075e54] px-3 py-2.5 text-white">
        <span className="text-lg leading-none opacity-80">›</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white"><Brand_Glyph size={24} /></span>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-[12px] font-bold">مركز خدمة السيارات
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#25D366" /><path d="M7 12.5l3.2 3L17 9" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div className="text-[9px] text-white/75">حساب أعمال موثّق</div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3 [background-image:radial-gradient(rgba(7,94,84,0.06)_1px,transparent_1px)] [background-size:14px_14px]">
        <span className="mx-auto rounded-lg bg-white/90 px-2.5 py-0.5 text-[9px] text-[#54656f] shadow-sm">اليوم</span>
        <span className="mx-auto rounded-lg bg-[#fff5c4] px-2.5 py-1 text-center text-[8.5px] leading-snug text-[#54656f]">🔒 الرسائل مشفرة تماماً بين الطرفين</span>
        <motion.div initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 20, delay: 0.15 }}
          className="mt-auto w-[90%] self-start overflow-hidden rounded-xl rounded-ss-sm bg-white text-[10.5px] text-ink shadow-sm">
          {/* receipt card */}
          <div className="bg-gradient-to-l from-navy to-[#123a66] px-3 py-2.5 text-white">
            <div className="flex items-center justify-between">
              <span className="font-bold">إيصال ضريبي</span>
              <span className="rounded-full bg-[#25D366] px-2 py-0.5 text-[8.5px] font-bold text-white">مدفوع ✓</span>
            </div>
            <div className="mt-0.5 text-[8.5px] text-white/70" dir="ltr">GOS-2026-000123 · 24/11/2026</div>
          </div>
          <div className="space-y-1 px-3 py-2">
            {rows.map(([k, v], i) => (
              <motion.div key={k} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.1 }} className="flex justify-between">
                <span className="text-mist">{k}</span><span className="font-semibold">{v}</span>
              </motion.div>
            ))}
            <div className="mt-1.5 flex items-center justify-between border-t border-dashed border-line pt-1.5">
              <span className="font-bold">الإجمالي</span><span className="font-display text-[13px] font-extrabold text-navy">٢٬١٦٦٫٠٠ ج.م</span>
            </div>
          </div>
          <div className="mx-2 mb-2 flex items-center gap-2 rounded-lg bg-[#f5f6f6] p-2">
            <span className="flex h-7 w-6 items-center justify-center rounded-sm bg-[#e5533d] text-[7px] font-bold text-white">PDF</span>
            <div className="flex-1"><div className="text-[9.5px] font-semibold">إيصال-000123.pdf</div><div className="text-[8px] text-mist">صفحة واحدة · ٨٤ ك.ب</div></div>
          </div>
          <div className="px-3 pb-2 text-[10px] leading-relaxed">شكراً لزيارتك! نتمنى لك قيادة آمنة 🚗</div>
          <div className="flex items-center justify-end gap-1 px-3 pb-1.5 text-[8.5px] text-mist">١٠:٤٢ ص <span className="text-[#53bdeb]">✓✓</span></div>
          <div className="grid grid-cols-2 border-t border-line text-center text-[10px] font-semibold text-[#027eb5]">
            <span className="border-e border-line py-1.5">عرض الإيصال</span><span className="py-1.5">قيّم الخدمة ⭐</span>
          </div>
        </motion.div>
      </div>
      <div className="flex items-center gap-2 bg-[#f0f2f5] px-2 py-2">
        <span className="flex-1 rounded-full bg-white px-3 py-1.5 text-[9.5px] text-mist">اكتب رسالة</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00a884] text-[10px] text-white">🎤</span>
      </div>
    </div>
  );
}

function Phone_Screen({ step, width }: { step: number; width?: number }) {
  const screens = [
    <div key="0" className="flex h-full flex-col bg-ink">
      <App_Bar title="Scan plate" sub="Bay 2 · Morning shift" dark />
      <div className="relative mx-4 mt-2 flex flex-1 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-[#16304f] to-[#0a1626]">
        {['left-3 top-3 border-l-2 border-t-2', 'right-3 top-3 border-r-2 border-t-2', 'left-3 bottom-3 border-l-2 border-b-2', 'right-3 bottom-3 border-r-2 border-b-2'].map((c) => <span key={c} className={`absolute h-5 w-5 rounded-sm border-glow/80 ${c}`} />)}
        <div className="relative w-[82%] overflow-hidden rounded-lg border-2 border-ink bg-white text-ink" dir="ltr">
          <div className="flex justify-between bg-[#8EC3EA] px-2 text-[9px] font-extrabold"><span>EGYPT</span><span>مصر</span></div>
          <div className="py-2 text-center font-arabic text-2xl font-extrabold">ق ص ر ١٤٢٧</div>
          <motion.div className="absolute inset-y-0 w-1 bg-glow shadow-[0_0_16px_6px_rgba(127,211,207,.7)]" animate={{ left: ['0%', '97%', '0%'] }} transition={{ duration: 2.2, repeat: Infinity }} />
        </div>
      </div>
      <div className="m-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white">
        <div><div className="text-[10px] text-white/55">Recognised</div><div className="font-mono text-sm font-bold">QCR1427</div></div>
        <span className="rounded-full border border-glow/40 px-2.5 py-0.5 text-[11px] font-bold text-glow">98%</span>
      </div>
    </div>,
    <div key="1" className="flex h-full flex-col bg-paper">
      <App_Bar title="Order #123" sub="Toyota Corolla · Silver" />
      <div className="mx-4 rounded-3xl bg-navy p-4 text-white">
        <div className="flex items-center justify-between text-[10px] text-white/60"><span>Timer</span><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-glow" />Live</span></div>
        <div className="font-display text-3xl font-bold tracking-tight">00:42</div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15"><motion.div className="h-full bg-glow" initial={{ width: '10%' }} animate={{ width: '66%' }} transition={{ duration: 1.4 }} /></div>
      </div>
      <div className="mt-3 space-y-2 px-4">
        {([['Oil change', 'Karim', true], ['Brake pads', 'Karim', false], ['Wheel alignment', 'Youssef', false]] as const).map(([name, who, done], i) => (
          <motion.div key={name} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.12 }}
            className="flex items-center justify-between rounded-2xl bg-white px-3.5 py-3 text-xs font-semibold">
            <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${done ? 'bg-teal' : 'border border-navy/25'}`} />{name}</span>
            <span className="text-[10px] font-medium text-mist">{who}</span>
          </motion.div>
        ))}
      </div>
    </div>,
    <div key="2" className="flex h-full flex-col bg-paper">
      <App_Bar title="Checkout" sub="Receipt GOS-2026-000123" />
      <div className="mx-4 rounded-3xl bg-white p-4">
        {[['Oil change', '700.00'], ['Brake pads', '1,200.00'], ['Subtotal', '1,900.00'], ['VAT 14%', '266.00']].map(([k, v], i) => (
          <motion.div key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }} className={`flex justify-between py-1.5 text-xs ${i === 1 ? 'border-b border-line pb-2.5' : ''}`}><span className="text-mist">{k}</span><span className="font-mono text-ink">{v}</span></motion.div>
        ))}
      </div>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.45, type: 'spring' }} className="mx-4 mt-3 rounded-3xl bg-navy p-4 text-white">
        <div className="text-[10px] text-white/60">Total · tax included</div><div className="font-display text-2xl font-bold">EGP 2,166.00</div>
      </motion.div>
      <div className="mt-auto grid grid-cols-2 gap-2 p-4">{['Cash', 'Card'].map((m, i) => <span key={m} className={`rounded-2xl py-3 text-center text-xs font-bold ${i === 0 ? 'bg-amber text-navy' : 'border border-navy/15 text-navy'}`}>{m}</span>)}</div>
    </div>,
    <Whatsapp_Receipt key="3" />,
  ];
  return (
    <Phone_Frame dark={step === 0} width={width}>
      {/* new screen opens as a growing circle from the bottom (like the app's own transition); the old one sinks and blurs */}
      <AnimatePresence initial={false}>
        <motion.div key={step} className="absolute inset-0"
          initial={{ clipPath: 'circle(0% at 50% 92%)', scale: 1.06 }} animate={{ clipPath: 'circle(150% at 50% 92%)', scale: 1 }}
          exit={{ opacity: 0, scale: 0.92, filter: 'blur(6px)', transition: { duration: 0.45, ease } }} transition={{ duration: 0.7, ease }}>
          {screens[step]}
        </motion.div>
      </AnimatePresence>
    </Phone_Frame>
  );
}

/** One segment of the progress rail; fills while its step is scrolled through. */
function Rail_Segment({ progress, index, active }: { progress: MotionValue<number>; index: number; active: boolean }) {
  const fill = useTransform(progress, [index / 4, (index + 1) / 4], ['0%', '100%']);
  return (
    <div className={`h-1.5 flex-1 overflow-hidden rounded-full transition-colors ${active ? 'bg-navy/15' : 'bg-navy/[0.07]'}`}>
      <motion.div className="h-full rounded-full bg-gradient-to-r from-teal to-glow" style={{ width: fill }} />
    </div>
  );
}

function Step_Card({ t, i, active }: { t: Dictionary; i: number; active: boolean }) {
  const Icon = STEP_ICONS[i];
  const s = t.flow.steps[i];
  return (
    <div className={`relative rounded-3xl p-6 transition-all duration-500 sm:p-8 ${active ? 'bg-white shadow-[0_20px_50px_-30px_rgba(11,37,69,0.35)]' : ''}`}>
      <div className="flex items-center gap-4">
        <Glyph icon={Icon} active={active} />
        <span className="font-mono text-sm text-mist">0{i + 1}</span>
      </div>
      <h3 className="mt-4 font-display text-2xl font-bold text-navy">{s.title}</h3>
      <p className="mt-2 max-w-lg text-mist">{s.text}</p>
    </div>
  );
}

export function Flow_Story({ t }: { t: Dictionary }) {
  // desktop: list on the left, sticky phone on the right
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start center', 'end center'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) => setStep(Math.min(3, Math.max(0, Math.floor(v * 4)))));

  // mobile: one sticky stage; scrolling flips the step card and opens the next screen
  const mobileRef = useRef<HTMLDivElement>(null);
  const [mStep, setMStep] = useState(0);
  const [dir, setDir] = useState(1);
  const { scrollYProgress: mProgress } = useScroll({ target: mobileRef, offset: ['start start', 'end end'] });
  useMotionValueEvent(mProgress, 'change', (v) => {
    const next = Math.min(3, Math.max(0, Math.floor(v * 4)));
    if (next !== mStep) { setDir(next > mStep ? 1 : -1); setMStep(next); }
  });

  return (
    <section id="how" className="relative py-24">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal><p className="eyebrow">{t.flow.eyebrow}</p><h2 className="mt-3 max-w-2xl font-display text-4xl font-bold text-navy sm:text-5xl">{t.flow.title}</h2></Reveal>
      </div>

      {/* ------------------------------------------------ desktop */}
      <div ref={ref} className="mx-auto mt-14 hidden max-w-7xl gap-12 px-5 lg:grid lg:grid-cols-[1fr_auto]">
        <ol className="space-y-[28vh] pb-[20vh]">
          {t.flow.steps.map((s, i) => (
            <motion.li key={s.title} animate={{ opacity: i === step ? 1 : 0.4, x: i === step ? 0 : -6 }} transition={{ duration: 0.4, ease }}>
              <Step_Card t={t} i={i} active={i === step} />
            </motion.li>
          ))}
        </ol>
        <div><div className="sticky top-28"><Phone_Screen step={step} />
          <div className="mt-6 flex justify-center gap-2">{[0, 1, 2, 3].map((i) => <motion.span key={i} className="h-1.5 rounded-full bg-navy" animate={{ width: i === step ? 28 : 8, opacity: i === step ? 1 : 0.25 }} />)}</div>
        </div></div>
      </div>

      {/* ------------------------------------------------ mobile / tablet */}
      <div ref={mobileRef} className="relative mt-8 h-[420vh] lg:hidden">
        <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col px-5 pb-4 pt-4">
          <div className="flex gap-1.5">{[0, 1, 2, 3].map((i) => <Rail_Segment key={i} progress={mProgress} index={i} active={i <= mStep} />)}</div>
          <div className="relative mt-4 [perspective:1200px]">
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div key={mStep} custom={dir}
                variants={{
                  enter: (d: number) => ({ opacity: 0, rotateX: d > 0 ? -70 : 70, y: d > 0 ? 40 : -40, filter: 'blur(6px)' }),
                  center: { opacity: 1, rotateX: 0, y: 0, filter: 'blur(0px)' },
                  exit: (d: number) => ({ opacity: 0, rotateX: d > 0 ? 70 : -70, y: d > 0 ? -40 : 40, filter: 'blur(6px)' }),
                }}
                initial="enter" animate="center" exit="exit" transition={{ duration: 0.45, ease }} style={{ transformOrigin: 'center center' }}>
                <div className="rounded-3xl bg-white p-5 shadow-[0_20px_50px_-30px_rgba(11,37,69,0.35)]">
                  <div className="flex items-center gap-3">
                    <Glyph icon={STEP_ICONS[mStep]} size={40} active />
                    <span className="font-mono text-xs text-mist">0{mStep + 1} / 04</span>
                  </div>
                  <h3 className="mt-3 font-display text-xl font-bold text-navy">{t.flow.steps[mStep].title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-mist">{t.flow.steps[mStep].text}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="relative mt-4 flex min-h-0 flex-1 items-start justify-center">
            <div className="pointer-events-none absolute inset-x-8 top-10 h-64 rounded-full bg-teal/15 blur-3xl" />
            <div className="origin-top scale-[0.78] [@media(min-height:820px)]:scale-90">
              <Phone_Screen step={mStep} width={260} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ FEATURES (spotlight cards) */
const FEATURE_ICONS = [ScanLine, Camera, Car, MessageCircle, Users, BarChart3, WifiOff, FileSpreadsheet];

export function Feature_Grid({ t }: { t: Dictionary }) {
  const onMove = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`);
  };
  return (
    <section id="features" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal><p className="eyebrow">{t.features.eyebrow}</p><h2 className="mt-3 max-w-3xl font-display text-4xl font-bold text-navy sm:text-5xl">{t.features.title}</h2></Reveal>
        <motion.div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" initial="h" whileInView="s" viewport={{ once: true, margin: '-60px' }}
          variants={{ h: {}, s: { transition: { staggerChildren: 0.06 } } }}>
          {t.features.items.map((f, i) => {
            const Icon = FEATURE_ICONS[i];
            return (
              <motion.article key={f.title} onMouseMove={onMove} variants={{ h: { opacity: 0, y: 24 }, s: { opacity: 1, y: 0, transition: { duration: 0.6, ease } } }}
                whileHover={{ y: -6 }} className="group relative overflow-hidden rounded-3xl border border-line bg-paper p-6">
                <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: 'radial-gradient(320px circle at var(--x) var(--y), rgba(127,211,207,0.35), transparent 60%)' }} />
                <span className="relative"><Glyph icon={Icon} size={48} /></span>
                <h3 className="relative mt-5 font-display text-xl font-bold text-navy">{f.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-mist">{f.text}</p>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ SECURITY (walls drawn on scroll) */
export function Security_Vault({ t }: { t: Dictionary }) {
  return (
    <section id="security" className="relative overflow-hidden bg-deep py-28 text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 lg:grid-cols-2">
        <Reveal>
          <p className="eyebrow !text-glow">{t.security.eyebrow}</p>
          <h2 className="mt-3 font-display text-4xl font-bold sm:text-5xl">{t.security.title}</h2>
          <p className="mt-6 text-lg leading-relaxed text-white/70">{t.security.text}</p>
          <ol className="mt-8 grid gap-2 sm:grid-cols-2">
            {t.security.walls.map((w, i) => (
              <motion.li key={w} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.12 }}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-glow/15 font-mono text-xs text-glow">{i + 1}</span>{w}
              </motion.li>
            ))}
          </ol>
        </Reveal>
        <div className="relative mx-auto aspect-square w-full max-w-[460px]" aria-hidden="true">
          <svg viewBox="0 0 400 400" className="h-full w-full">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const inset = 20 + i * 22;
              return (
                <motion.rect key={i} x={inset} y={inset} width={400 - inset * 2} height={400 - inset * 2} rx={40 - i * 3}
                  fill="none" stroke={i === 6 ? '#F2B544' : '#7FD3CF'} strokeOpacity={0.25 + i * 0.1} strokeWidth={i === 6 ? 3 : 1.5}
                  initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, delay: 0.2 + (6 - i) * 0.18, ease }} />
              );
            })}
            <motion.g initial={{ scale: 0, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.6, type: 'spring', stiffness: 200, damping: 14 }} style={{ originX: '200px', originY: '200px' }}>
              <circle cx={200} cy={200} r={34} fill="#0B2545" stroke="#F2B544" strokeWidth={2} />
              <path d="M188 200l9 9 17-19" fill="none" stroke="#7FD3CF" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            </motion.g>
            <motion.circle cx={200} cy={200} r={60} fill="none" stroke="#7FD3CF" strokeOpacity={0.4}
              animate={{ r: [40, 175], opacity: [0.6, 0] }} transition={{ duration: 3.2, repeat: Infinity, delay: 2, ease: 'easeOut' }} />
          </svg>
          <ShieldCheck className="absolute end-4 top-4 text-glow" size={28} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ PLANS + FAQ */
export function Plans({ t }: { t: Dictionary }) {
  const choose = (code: string) => window.dispatchEvent(new CustomEvent('choose-plan', { detail: code }));
  return (
    <section id="plans" className="mx-auto max-w-7xl px-5 py-24">
      <Reveal className="text-center"><p className="eyebrow">{t.plans.eyebrow}</p><h2 className="mx-auto mt-3 max-w-2xl font-display text-4xl font-bold text-navy sm:text-5xl">{t.plans.title}</h2><p className="mt-4 text-mist">{t.plans.note}</p></Reveal>
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {t.plans.items.map((p, i) => {
          const featured = p.code === 'pro';
          return (
            <Reveal key={p.code} delay={i * 0.1}>
              <motion.article whileHover={{ y: -8 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                className={`relative flex h-full flex-col rounded-[28px] p-8 ${featured ? 'bg-navy text-white shadow-2xl shadow-navy/30' : 'border border-line bg-white'}`}>
                {featured && <span className="absolute -top-3 start-8 rounded-full bg-amber px-3 py-1 text-xs font-bold text-navy">{t.plans.popular}</span>}
                <h3 className={`font-display text-3xl font-bold ${featured ? '' : 'text-navy'}`}>{p.name}</h3>
                <p className={`mt-1 ${featured ? 'text-white/60' : 'text-mist'}`}>{p.who}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {p.points.map((pt) => <li key={pt} className="flex gap-3 text-sm"><Check size={18} className={featured ? 'shrink-0 text-glow' : 'shrink-0 text-teal'} />{pt}</li>)}
                </ul>
                <a href="#request" onClick={() => choose(p.code)} className={`btn mt-8 ${featured ? 'btn-amber' : 'btn-navy'}`}>{t.plans.cta}</a>
              </motion.article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
