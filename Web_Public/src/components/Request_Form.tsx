'use client';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Building2, Check, Mail, MapPin, MessageSquare, Minus, Phone, Plus, Send, ShieldCheck, Sparkles, User, Users } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import type { Locale } from '@/config/Brand_Config';
import type { Dictionary } from '@/i18n/Dictionary';
import { GOVERNORATES } from '@/i18n/Governorates';
import { Fancy_Select } from './Fancy_Select';

const API = process.env.NEXT_PUBLIC_STATION_API_URL ?? 'http://localhost:3000/v1';
const ease = [0.2, 0, 0, 1] as const;
const STEP_ICONS = [Building2, Users, Phone];

export function Request_Form({ t, locale }: { t: Dictionary; locale: Locale }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    businessName: '', businessNameAr: '', city: '', branchesCount: 1, workersCount: 5, planCode: 'pro',
    contactName: '', contactPhone: '', contactEmail: '', message: '', website: '',
  });

  useEffect(() => {
    const onPlan = (e: Event) => setF((x) => ({ ...x, planCode: (e as CustomEvent<string>).detail }));
    window.addEventListener('choose-plan', onPlan);
    return () => window.removeEventListener('choose-plan', onPlan);
  }, []);

  const set = (k: keyof typeof f, v: string | number) => setF((x) => ({ ...x, [k]: v }));
  const valid = [
    f.businessName.trim().length >= 2,
    f.branchesCount >= 1 && f.workersCount >= 1,
    f.contactName.trim().length >= 2 && /^\+?[0-9 ]{8,20}$/.test(f.contactPhone.trim()),
  ];
  const go = (to: number) => { setDir(to > step ? 1 : -1); setStep(to); };
  const plan = t.plans.items.find((p) => p.code === f.planCode);
  const cityLabel = GOVERNORATES.find(([en]) => en === f.city)?.[locale === 'ar' ? 1 : 0] ?? '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step < 2) { if (valid[step]) go(step + 1); return; }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API}/public/station-requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planCode: f.planCode, businessName: f.businessName.trim(), businessNameAr: f.businessNameAr.trim() || undefined, contactName: f.contactName.trim(),
          contactPhone: f.contactPhone.trim(), contactEmail: f.contactEmail.trim() || undefined, city: f.city.trim() || undefined,
          branchesCount: Number(f.branchesCount), workersCount: Number(f.workersCount), message: f.message.trim() || undefined, locale, website: f.website || undefined,
        }),
      });
      if (response.status === 429) throw new Error(t.form.errorRate);
      if (!response.ok) throw new Error(t.form.errorGeneric);
      setDone(true);
    } catch (err) {
      setError((err as Error).message || t.form.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="request" className="relative overflow-hidden bg-navy py-24 text-white sm:py-28">
      {/* backdrop: grid that fades out, two drifting glows, a slow light beam */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_30%_40%,black,transparent_70%)]" />
      <motion.div className="pointer-events-none absolute -bottom-40 end-0 h-[520px] w-[520px] rounded-full bg-teal/30 blur-[130px]"
        animate={{ x: [0, -60, 0], y: [0, -30, 0] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="pointer-events-none absolute -top-32 start-[-10%] h-[420px] w-[420px] rounded-full bg-amber/15 blur-[130px]"
        animate={{ x: [0, 50, 0] }} transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="pointer-events-none absolute -inset-y-20 w-40 rotate-12 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
        animate={{ x: ['-20vw', '120vw'] }} transition={{ duration: 9, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }} />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        {/* ------------------------------------------------------------ story + timeline + ticket */}
        <div>
          <p className="eyebrow !text-glow">{t.form.eyebrow}</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">{t.form.title}</h2>
          <p className="mt-5 text-lg text-white/70">{t.form.text}</p>

          <ol className="relative mt-10 space-y-6">
            <span className="absolute start-[21px] top-3 h-[calc(100%-24px)] w-px bg-white/10" />
            <motion.span className="absolute start-[21px] top-3 w-px origin-top bg-gradient-to-b from-amber to-glow"
              animate={{ height: `calc(${(done ? 2 : step) * 50}% - ${(done ? 2 : step) * 12}px)` }} transition={{ duration: 0.6, ease }} />
            {t.form.steps.map((s, i) => {
              const Icon = STEP_ICONS[i];
              const passed = i < step || done;
              const current = i === step && !done;
              return (
                <li key={s} className="relative flex items-center gap-4">
                  <motion.span animate={{ scale: current ? 1.08 : 1 }}
                    className={`relative flex h-11 w-11 items-center justify-center rounded-full ring-1 transition-colors duration-500 ${passed ? 'bg-amber text-navy ring-amber' : current ? 'bg-navy text-amber ring-amber/70' : 'bg-navy text-white/40 ring-white/15'}`}>
                    {current && <motion.span className="absolute inset-0 rounded-full ring-1 ring-amber/60" animate={{ scale: [1, 1.5], opacity: [0.7, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />}
                    {passed ? <Check size={18} strokeWidth={2.4} /> : <Icon size={18} />}
                  </motion.span>
                  <div>
                    <div className={`font-semibold transition-colors ${current || passed ? 'text-white' : 'text-white/50'}`}>{s}</div>
                    <div className="text-sm text-white/45">{t.form.stepHints[i]}</div>
                  </div>
                </li>
              );
            })}
          </ol>

          <Request_Ticket t={t} f={f} city={cityLabel} planName={plan?.name ?? ''} done={done} />
        </div>

        {/* ------------------------------------------------------------ form card with travelling edge light */}
        <div className="relative self-start">
          <div className="absolute -inset-px overflow-hidden rounded-[34px]">
            <motion.div className="absolute -inset-[60%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(242,181,68,0.95)_40deg,transparent_100deg,transparent_200deg,rgba(127,211,207,0.9)_250deg,transparent_310deg)]"
              animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} />
          </div>
          <div className="relative rounded-[34px] bg-white p-6 text-ink shadow-[0_50px_100px_-40px_rgba(0,0,0,0.7)] sm:p-9">
            {!done && (
              <div className="mb-7">
                <div className="flex items-center justify-between text-xs font-semibold text-mist">
                  <span>{t.form.steps[step]}</span><span className="font-mono">{step + 1} / 3</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-teal to-glow" animate={{ width: `${((step + 1) / 3) * 100}%` }} transition={{ duration: 0.5, ease }} />
                </div>
              </div>
            )}
            <AnimatePresence mode="wait" custom={dir}>
              {done ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <div className="relative">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <motion.span key={i} className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full" style={{ background: i % 3 === 0 ? '#F2B544' : i % 3 === 1 ? '#0E8A86' : '#7FD3CF' }}
                        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos((i / 12) * Math.PI * 2) * 90, y: Math.sin((i / 12) * Math.PI * 2) * 90, opacity: 0, scale: 0.4 }}
                        transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }} />
                    ))}
                    <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}
                      className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-teal to-[#0b6f6b] text-white shadow-[0_20px_40px_-10px_rgba(14,138,134,0.6)]"><Check size={46} strokeWidth={2.6} /></motion.div>
                  </div>
                  <h3 className="mt-7 font-display text-3xl font-bold text-navy">{t.form.successTitle}</h3>
                  <p className="mt-3 max-w-sm text-mist">{t.form.successText}</p>
                </motion.div>
              ) : (
                <motion.form key={step} onSubmit={submit} noValidate custom={dir}
                  variants={{
                    enter: (d: number) => ({ opacity: 0, x: d * 40, rotateY: d * 8, filter: 'blur(6px)' }),
                    center: { opacity: 1, x: 0, rotateY: 0, filter: 'blur(0px)' },
                    exit: (d: number) => ({ opacity: 0, x: d * -40, rotateY: d * -8, filter: 'blur(6px)' }),
                  }}
                  initial="enter" animate="center" exit="exit" transition={{ duration: 0.38, ease }} className="flex min-h-[420px] flex-col gap-4 [transform-style:preserve-3d]">
                  {/* honeypot: invisible to people, bots fill it */}
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set('website', e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true" />
                  {step === 0 && (<>
                    <Light_Field label={t.form.businessName} icon={Building2} value={f.businessName} onChange={(v) => set('businessName', v)} dir="ltr" autoFocus />
                    <Light_Field label={t.form.businessNameAr} icon={Building2} value={f.businessNameAr} onChange={(v) => set('businessNameAr', v)} dir="rtl" />
                    <div>
                      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-navy"><MapPin size={14} className="text-teal" />{t.form.city}</span>
                      <Fancy_Select label={t.form.city} value={f.city} onChange={(v) => set('city', v)} placeholder="—"
                        options={GOVERNORATES.map(([en, ar]) => ({ value: en, label: locale === 'ar' ? ar : en, hint: locale === 'ar' ? en : ar }))} />
                    </div>
                  </>)}
                  {step === 1 && (<>
                    <div className="grid grid-cols-2 gap-3">
                      <Stepper label={t.form.branches} icon={Building2} value={f.branchesCount} min={1} max={500} onChange={(v) => set('branchesCount', v)} />
                      <Stepper label={t.form.workers} icon={Users} value={f.workersCount} min={1} max={5000} step={5} onChange={(v) => set('workersCount', v)} />
                    </div>
                    <fieldset><legend className="mb-2 text-sm font-semibold text-navy">{t.form.plan}</legend>
                      <div className="grid gap-2.5 sm:grid-cols-3">
                        {t.plans.items.map((p) => {
                          const on = f.planCode === p.code;
                          return (
                            <motion.button key={p.code} type="button" onClick={() => set('planCode', p.code)} aria-pressed={on} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
                              className={`relative min-h-[88px] overflow-hidden rounded-2xl px-4 py-3 text-start transition-colors ${on ? 'text-white' : 'bg-paper text-navy hover:bg-[#e8eef5]'}`}>
                              {on && <motion.span layoutId="plan-bg" className="absolute inset-0 bg-gradient-to-br from-navy to-[#164a7a]" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                              <span className="relative flex items-center justify-between font-display font-bold">{p.name}
                                {on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex h-5 w-5 items-center justify-center rounded-full bg-amber text-navy"><Check size={12} strokeWidth={3} /></motion.span>}
                              </span>
                              <span className={`relative mt-1 block text-xs ${on ? 'text-white/70' : 'text-mist'}`}>{p.who}</span>
                              <span className={`relative mt-1 block text-[11px] ${on ? 'text-glow' : 'text-teal'}`}>{p.points[0]}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </fieldset>
                  </>)}
                  {step === 2 && (<>
                    <Light_Field label={t.form.contactName} icon={User} value={f.contactName} onChange={(v) => set('contactName', v)} autoFocus />
                    <Light_Field label={t.form.phone} icon={Phone} value={f.contactPhone} onChange={(v) => set('contactPhone', v)} dir="ltr" inputMode="tel" />
                    <Light_Field label={t.form.email} icon={Mail} value={f.contactEmail} onChange={(v) => set('contactEmail', v)} dir="ltr" type="email" />
                    <Light_Field label={t.form.message} icon={MessageSquare} value={f.message} onChange={(v) => set('message', v)} multiline />
                  </>)}

                  <AnimatePresence>
                    {error && <motion.p role="alert" initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: [0, -8, 8, -4, 4, 0] }} exit={{ opacity: 0 }}
                      className="rounded-xl bg-orange/10 px-4 py-2.5 text-sm font-semibold text-[#8A3D0C]">{error}</motion.p>}
                  </AnimatePresence>

                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    {t.form.perks.map((p, i) => (
                      <span key={p} className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-[11px] font-semibold text-mist">
                        {i === 0 ? <ShieldCheck size={12} className="text-teal" /> : i === 1 ? <User size={12} className="text-teal" /> : <Sparkles size={12} className="text-teal" />}{p}
                      </span>
                    ))}
                  </div>
                  <div className="flex justify-between gap-3">
                    <button type="button" className="btn border border-line text-navy disabled:invisible" disabled={step === 0} onClick={() => go(step - 1)}><ArrowLeft size={18} className="rtl:rotate-180" />{t.form.back}</button>
                    <motion.button type="submit" whileTap={{ scale: 0.97 }} disabled={!valid[step] || busy}
                      className={`btn group relative overflow-hidden ${step === 2 ? 'btn-amber' : 'btn-navy'} disabled:opacity-40`}>
                      {valid[step] && !busy && <motion.span className="absolute inset-y-0 w-1/3 -skew-x-12 bg-white/25 blur-md" initial={{ x: '-200%' }} animate={{ x: '400%' }} transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.2 }} />}
                      <span className="relative flex items-center gap-2">
                        {step < 2 ? <>{t.form.next}<ArrowRight size={18} className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" /></>
                          : <>{busy ? t.form.sending : t.form.submit}<Send size={18} className="rtl:-scale-x-100" /></>}
                      </span>
                    </motion.button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------------- pieces */

/** Boarding-pass style summary that fills itself while the visitor types. */
function Request_Ticket({ t, f, city, planName, done }: {
  t: Dictionary; f: { businessName: string; businessNameAr: string; branchesCount: number; workersCount: number; contactName: string; contactPhone: string }; city: string; planName: string; done: boolean;
}) {
  const name = f.businessName || f.businessNameAr;
  const rows: [string, string][] = [
    [t.form.businessName.split('(')[0].trim(), name],
    [t.form.city, city],
    [`${t.form.branches} · ${t.form.workers}`, name ? `${f.branchesCount} · ${f.workersCount}` : ''],
    [t.form.contactName, f.contactName],
  ];
  const empty = !name && !f.contactName;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}
      className="relative mt-10 hidden max-w-md overflow-hidden rounded-3xl bg-white/[0.05] ring-1 ring-white/10 backdrop-blur sm:block">
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-glow">{t.form.ticket}</span>
        <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-[11px] font-bold text-amber">{planName}</span>
      </div>
      <div className="space-y-2 px-5 py-4">
        {empty ? <p className="py-3 text-sm text-white/45">{t.form.ticketEmpty}</p> : rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="shrink-0 text-white/45">{k}</span>
            <AnimatePresence mode="wait"><motion.span key={v} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="truncate font-semibold text-white">{v || '—'}</motion.span></AnimatePresence>
          </div>
        ))}
      </div>
      {/* perforation with notches */}
      <div className="relative h-4">
        <span className="absolute -start-2 top-0 h-4 w-4 rounded-full bg-navy" />
        <span className="absolute -end-2 top-0 h-4 w-4 rounded-full bg-navy" />
        <span className="absolute inset-x-4 top-1/2 border-t border-dashed border-white/15" />
      </div>
      <div className="flex items-center justify-between px-5 pb-4 pt-1">
        <div className="flex h-8 items-end gap-[2px]" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, i) => <span key={i} className="w-[2px] bg-white/30" style={{ height: `${40 + ((i * 37) % 60)}%` }} />)}
        </div>
        <span className="font-mono text-[11px] text-white/40">REQ-{new Date().getFullYear()}-••••</span>
      </div>
      <AnimatePresence>
        {done && (
          <motion.div initial={{ scale: 2.4, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -12 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.3 }}
            className="absolute end-6 top-10 rounded-xl border-2 border-amber px-3 py-1.5 font-display text-lg font-extrabold uppercase tracking-widest text-amber">
            ✓ {t.form.successTitle}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Floating-label field on the white card. */
function Light_Field({ label, icon: Icon, value, onChange, dir, type = 'text', inputMode, multiline = false, autoFocus = false }: {
  label: string; icon: typeof User; value: string; onChange: (v: string) => void; dir?: 'ltr' | 'rtl'; type?: string;
  inputMode?: 'tel' | 'text' | 'email'; multiline?: boolean; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;
  const common = {
    value, dir, 'aria-label': label, onFocus: () => setFocused(true), onBlur: () => setFocused(false),
    className: 'w-full bg-transparent text-[15px] text-ink outline-none',
  };
  return (
    <motion.div animate={{ boxShadow: focused ? '0 0 0 4px rgba(14,138,134,0.12)' : '0 0 0 0 rgba(14,138,134,0)' }}
      className={`relative flex rounded-2xl bg-paper ring-1 transition-colors ${focused ? 'bg-white ring-teal/60' : 'ring-transparent hover:ring-line'} ${multiline ? 'min-h-[104px] items-start' : 'h-[60px] items-center'}`}>
      <Icon size={18} className={`ms-4 shrink-0 transition-colors ${multiline ? 'mt-5' : ''} ${focused ? 'text-teal' : 'text-mist'}`} />
      <div className={`relative flex-1 px-3 ${multiline ? 'pb-3 pt-7' : 'h-full'}`}>
        <motion.label className="pointer-events-none absolute start-3 origin-[0%_50%] rtl:origin-[100%_50%]" initial={false}
          animate={lifted ? { top: 9, scale: 0.78, color: focused ? '#0E8A86' : '#5A6B7D' } : { top: multiline ? 18 : 19, scale: 1, color: '#7b8a9a' }} transition={{ duration: 0.18, ease }}>
          {label}
        </motion.label>
        {multiline
          ? <textarea {...common} maxLength={1000} rows={2} onChange={(e) => onChange(e.target.value)} className={`${common.className} resize-none`} />
          : <input {...common} type={type} inputMode={inputMode} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} className={`${common.className} absolute inset-x-3 bottom-2.5 w-auto`} />}
      </div>
    </motion.div>
  );
}

/** − value + control with a rolling number. */
function Stepper({ label, icon: Icon, value, min, max, step = 1, onChange }: { label: string; icon: typeof User; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const [editing, setEditing] = useState(false);
  return (
    <div className="rounded-2xl bg-paper p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-mist"><Icon size={13} className="text-teal" />{label}</div>
      <div className="mt-2 flex items-center justify-between">
        <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label={`− ${label}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-navy shadow-sm disabled:opacity-30"><Minus size={16} /></motion.button>
        <div className="relative h-9 w-16 overflow-hidden text-center">
          {editing ? (
            <input type="number" min={min} max={max} value={value} aria-label={label} autoFocus onBlur={() => setEditing(false)}
              onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
              className="h-9 w-full bg-transparent text-center font-display text-2xl font-bold text-navy outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          ) : (
            <button type="button" onClick={() => setEditing(true)} aria-label={label} className="h-9 w-full">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={value} className="block font-display text-2xl font-bold leading-9 text-navy"
                  initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }} transition={{ duration: 0.18 }}>{value}</motion.span>
              </AnimatePresence>
            </button>
          )}
        </div>
        <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label={`+ ${label}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-white shadow-sm disabled:opacity-30"><Plus size={16} /></motion.button>
      </div>
    </div>
  );
}
