'use client';
import { AnimatePresence, motion, MotionConfig, useMotionTemplate, useMotionValue, useSpring } from 'motion/react';
import { ArrowRight, Eye, EyeOff, Fingerprint, KeyRound, Lock, Mail, ScrollText, ShieldCheck, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { FormEvent, KeyboardEvent, MouseEvent, useEffect, useRef, useState } from 'react';
import { Brand_Mark } from '@/components/Brand_Mark';
import { Login_Backdrop } from '@/components/Login_Backdrop';
import { BRAND } from '@/config/Brand_Config';

type Step = 'password' | 'change' | 'mfa-setup' | 'mfa';

async function post(step: string, body: unknown = {}) {
  const response = await fetch(`/api/auth/${step}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

const POLICY_TEXT: Record<string, string> = {
  TOO_SHORT: 'at least 12 characters', TOO_COMMON: 'not a common or reused password', CONTAINS_USERNAME: 'must not contain your email name',
  NEEDS_VARIETY: 'mix 3 of: lowercase, UPPERCASE, digits, symbols', TOO_LONG: 'at most 128 characters',
};

const ease = [0.2, 0, 0, 1] as const;
const STEP_INDEX: Record<Step, number> = { password: 0, change: 1, 'mfa-setup': 2, mfa: 2 };
const ROTATING = ['every station.', 'every owner invite.', 'every request.', 'every audit trail.'];

export default function LoginPage() {
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [code, setCode] = useState('');
  const [qr, setQr] = useState<{ image: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [busy, setBusy] = useState(false);

  async function next(result: { ok: boolean; data: { next?: string; mustChangePassword?: boolean; code?: string; detail?: string; errors?: string[] } }) {
    if (!result.ok) {
      const policy = result.data.code === 'PASSWORD_POLICY' ? ` (${(result.data.errors ?? []).map((e) => POLICY_TEXT[e] ?? e).join(', ')})` : '';
      setError((result.data.detail ?? 'Something went wrong') + policy);
      setErrorKey((k) => k + 1);
      return;
    }
    setError(null);
    setCode('');
    if (result.data.next === 'done') { window.location.href = '/dashboard'; return; }
    if (result.data.next === 'mfa') { setStep('mfa'); return; }
    if (result.data.next === 'setup') {
      if (result.data.mustChangePassword) { setStep('change'); return; }
      const setup = await post('mfa-setup');
      if (!setup.ok) { setError(setup.data.detail ?? 'Could not start 2FA setup'); return; }
      setQr({ image: await QRCode.toDataURL(setup.data.otpauthUri, { margin: 1, width: 220, color: { dark: '#050F1D', light: '#FFFFFF' } }), secret: setup.data.secret });
      setStep('mfa-setup');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (step === 'password') await next(await post('login', { email, password }));
      else if (step === 'change') await next(await post('password', { currentPassword: password, newPassword }));
      else if (step === 'mfa-setup') await next(await post('mfa-enable', { code }));
      else await next(await post('mfa-verify', { code }));
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Step, { title: string; text: string; icon: typeof Lock }> = {
    password: { title: 'Welcome back', text: 'Company staff only. Station owners sign in on the mobile app.', icon: Lock },
    change: { title: 'Make it yours', text: 'First sign-in: replace the temporary password with your own.', icon: KeyRound },
    'mfa-setup': { title: 'Lock it with your phone', text: 'Scan with Google Authenticator, Microsoft Authenticator or Authy, then type the 6-digit code.', icon: Smartphone },
    mfa: { title: 'One more step', text: 'Open your authenticator app and type the current code.', icon: ShieldCheck },
  };
  const Icon = titles[step].icon;

  // card spotlight follows the pointer
  const mx = useMotionValue(-400);
  const my = useMotionValue(-400);
  const spot = useMotionTemplate`radial-gradient(420px circle at ${mx}px ${my}px, rgba(127,211,207,0.10), transparent 60%)`;
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left); my.set(e.clientY - r.top);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-clip bg-ink">
        <Aurora />
        <div className="grid-backdrop pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

        <div className="relative grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
          {/* ------------------------------------------------------------ story side */}
          <section className="relative hidden flex-col justify-between p-12 lg:flex">
            <Brand_Mark />
            <div className="absolute inset-x-10 top-24 bottom-48 opacity-90"><Login_Backdrop /></div>
            <div className="relative max-w-lg">
              <motion.p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-glow/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                {BRAND.consoleName}
              </motion.p>
              <h2 className="mt-3 font-display text-5xl font-bold leading-[1.05] text-white">
                One control room for<br /><Rotating words={ROTATING} />
              </h2>
              <div className="mt-8 flex flex-wrap gap-2">
                {[{ icon: Fingerprint, text: 'Argon2id passwords' }, { icon: ShieldCheck, text: '2-step required' }, { icon: ScrollText, text: 'Hash-chained audit' }].map((chip, i) => (
                  <motion.span key={chip.text} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.1, ease }}
                    className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3.5 py-2 text-xs text-fog ring-1 ring-white/[0.08] backdrop-blur">
                    <chip.icon size={14} className="text-glow" /> {chip.text}
                  </motion.span>
                ))}
              </div>
              <Cairo_Clock />
            </div>
          </section>

          {/* ------------------------------------------------------------ form side */}
          <section className="flex items-center justify-center p-5 sm:p-10">
            <motion.div className="relative w-full max-w-[440px]" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}>
              {/* rotating light around the card edge */}
              <div className="absolute -inset-px overflow-hidden rounded-[30px]">
                <motion.div className="absolute -inset-[60%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(127,211,207,0.9)_40deg,transparent_90deg,transparent_200deg,rgba(242,181,68,0.7)_240deg,transparent_290deg)]"
                  animate={{ rotate: 360 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }} />
              </div>
              <div onMouseMove={onMove} className="relative overflow-hidden rounded-[30px] bg-gradient-to-b from-[#0c2241]/95 to-[#06142a]/95 p-8 shadow-[0_50px_100px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-9">
                <motion.div className="pointer-events-none absolute inset-0" style={{ background: spot }} />
                <div className="relative">
                  <div className="mb-7 flex items-center justify-between">
                    <div className="lg:hidden"><Brand_Mark compact /></div>
                    <Step_Track index={STEP_INDEX[step]} />
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.form key={step} onSubmit={submit} className="space-y-5"
                      initial={{ opacity: 0, x: 28, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: -28, filter: 'blur(6px)' }}
                      transition={{ duration: 0.32, ease }}>
                      <div>
                        <motion.div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full text-glow"
                          initial={{ scale: 0.6, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
                          <span className="absolute inset-0 rounded-full ring-1 ring-glow/30" />
                          <motion.span className="absolute inset-0 rounded-full ring-1 ring-glow/40" animate={{ scale: [1, 1.35], opacity: [0.6, 0] }} transition={{ duration: 2, repeat: Infinity }} />
                          <span className="absolute inset-1 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(127,211,207,0.22),transparent_65%)]" />
                          <Icon size={22} className="relative" />
                        </motion.div>
                        <h1 className="font-display text-[28px] font-bold leading-tight text-white">{titles[step].title}</h1>
                        <p className="mt-1.5 text-sm leading-relaxed text-mist">{titles[step].text}</p>
                      </div>

                      {step === 'password' && (
                        <>
                          <Float_Field label="Work email" icon={Mail} type="email" autoComplete="username" value={email} onChange={setEmail} autoFocus />
                          <Float_Field label="Password" icon={Lock} type="password" autoComplete="current-password" value={password} onChange={setPassword} />
                        </>
                      )}
                      {step === 'change' && (
                        <>
                          <Float_Field label="New password" icon={KeyRound} type="password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} autoFocus />
                          <Strength value={newPassword} />
                        </>
                      )}
                      {step === 'mfa-setup' && qr && (
                        <div className="flex flex-col items-center gap-3">
                          <motion.div className="rounded-2xl bg-white p-2.5 shadow-[0_0_60px_-10px_rgba(127,211,207,0.5)]"
                            initial={{ opacity: 0, scale: 0.85, rotate: -4 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 16 }}>
                            <img src={qr.image} alt="2FA QR code" width={184} height={184} className="rounded-lg" />
                          </motion.div>
                          <code className="select-all break-all rounded-xl bg-ink/60 px-3 py-2 text-center font-mono text-[11px] text-mist ring-1 ring-white/5">{qr.secret}</code>
                        </div>
                      )}
                      {(step === 'mfa-setup' || step === 'mfa') && <Otp_Boxes value={code} onChange={setCode} />}

                      <AnimatePresence>
                        {error && (
                          <motion.p key={errorKey} role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-[#ffc2c2] ring-1 ring-danger/30"
                            initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
                            {error}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      <motion.button type="submit" disabled={busy} whileTap={{ scale: 0.98 }}
                        className="group relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-glow to-[#5fc2bd] font-semibold text-ink shadow-[0_18px_40px_-12px_rgba(127,211,207,0.55)] transition-opacity disabled:opacity-60">
                        <motion.span className="absolute inset-y-0 w-1/3 -skew-x-12 bg-white/35 blur-md" initial={{ x: '-150%' }} animate={{ x: '350%' }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }} />
                        {busy ? <Spinner /> : (
                          <span className="relative flex items-center gap-2">
                            {step === 'password' ? 'Continue' : step === 'change' ? 'Save password' : 'Verify'}
                            <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
                          </span>
                        )}
                      </motion.button>
                      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-mist/60">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-glow" /> Restricted to company staff · every action is audited
                      </p>
                    </motion.form>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </section>
        </div>
      </div>
    </MotionConfig>
  );
}

/* ---------------------------------------------------------------------------------- pieces */

/** Slow drifting colour fields behind everything. */
function Aurora() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-clip">
      <motion.div className="absolute -left-40 -top-40 h-[620px] w-[620px] rounded-full bg-teal/25 blur-[140px]"
        animate={{ x: [0, 80, 0], y: [0, 60, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute -bottom-52 right-[-10%] h-[560px] w-[560px] rounded-full bg-amber/10 blur-[150px]"
        animate={{ x: [0, -60, 0], y: [0, -40, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute right-[30%] top-[20%] h-[380px] w-[380px] rounded-full bg-[#2b5c9a]/20 blur-[130px]"
        animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
    </div>
  );
}

/** Headline word that flips through what the console controls. */
function Rotating({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % words.length), 2600); return () => clearInterval(t); }, [words.length]);
  return (
    <span className="relative block h-[1.2em] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.span key={words[i]} className="absolute left-0 whitespace-nowrap bg-gradient-to-r from-glow via-[#a8ece8] to-amber bg-clip-text text-transparent"
          initial={{ y: '100%', opacity: 0 }} animate={{ y: '0%', opacity: 1 }} exit={{ y: '-100%', opacity: 0 }} transition={{ duration: 0.45, ease }}>
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Cairo_Clock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()));
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);
  return (
    <div className="mt-10 flex items-center gap-3 text-xs text-mist">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-glow/60" /><span className="relative h-2 w-2 rounded-full bg-glow" /></span>
      Platform online · Cairo <span className="font-mono text-fog">{now ?? '--:--:--'}</span>
    </div>
  );
}

/** Three-segment progress: sign in → password → 2-step. */
function Step_Track({ index }: { index: number }) {
  const labels = ['Sign in', 'Password', '2-step'];
  return (
    <div className="ms-auto flex items-center gap-1.5" aria-label={`Step ${index + 1} of 3`}>
      {labels.map((label, i) => (
        <div key={label} className="flex flex-col items-end gap-1">
          <div className="relative h-1 w-10 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div className="absolute inset-y-0 left-0 rounded-full bg-glow" initial={false} animate={{ width: i <= index ? '100%' : '0%' }} transition={{ duration: 0.5, ease }} />
          </div>
          <span className={`text-[10px] tracking-wide ${i === index ? 'text-glow' : 'text-mist/50'}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

/** Floating-label field: label rests inside, lifts on focus; password eye toggle and Caps Lock hint. */
function Float_Field({ label, icon: Icon, type, value, onChange, autoComplete, autoFocus }: {
  label: string; icon: typeof Lock; type: 'email' | 'password' | 'text'; value: string; onChange: (v: string) => void; autoComplete?: string; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const lifted = focused || value.length > 0;
  const isPassword = type === 'password';
  const checkCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false);
  return (
    <div>
      <motion.div animate={{ boxShadow: focused ? '0 0 0 4px rgba(127,211,207,0.12)' : '0 0 0 0px rgba(127,211,207,0)' }}
        className={`relative flex h-[60px] items-center rounded-2xl bg-ink/55 ring-1 transition-colors ${focused ? 'ring-glow/70' : 'ring-white/[0.08] hover:ring-white/15'}`}>
        <Icon size={18} className={`ms-4 shrink-0 transition-colors ${focused ? 'text-glow' : 'text-mist/70'}`} />
        <div className="relative h-full flex-1 px-3">
          <motion.label className="pointer-events-none absolute left-3 origin-left text-mist" initial={false}
            animate={lifted ? { top: 9, scale: 0.75, color: focused ? '#7FD3CF' : '#a9bcd3' } : { top: 19, scale: 1, color: '#7d93ae' }} transition={{ duration: 0.18, ease }}>
            {label}
          </motion.label>
          <input className="absolute inset-x-3 bottom-2 bg-transparent text-[15px] text-white outline-none"
            type={isPassword && !show ? 'password' : isPassword ? 'text' : type} autoComplete={autoComplete} required autoFocus={autoFocus} aria-label={label}
            value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setCaps(false); }}
            onKeyUp={checkCaps} onKeyDown={checkCaps} />
        </div>
        {isPassword && (
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
            className="me-2 flex h-10 w-10 items-center justify-center rounded-full text-mist transition-colors hover:bg-white/5 hover:text-white">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={show ? 'off' : 'on'} initial={{ opacity: 0, rotate: -30 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 30 }} transition={{ duration: 0.15 }}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </motion.span>
            </AnimatePresence>
          </button>
        )}
      </motion.div>
      <AnimatePresence>
        {caps && isPassword && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="ps-2 pt-1.5 text-xs text-amber">Caps Lock is on</motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Live strength meter for the new password (hint only; the server enforces the real policy). */
function Strength({ value }: { value: string }) {
  const checks = [value.length >= 12, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)];
  const score = checks.filter(Boolean).length;
  const width = useSpring(0, { stiffness: 200, damping: 25 });
  useEffect(() => { width.set(score * 25); }, [score, width]);
  const bar = useMotionTemplate`${width}%`;
  const color = score <= 1 ? '#ef6b6b' : score === 2 ? '#F2B544' : score === 3 ? '#7FD3CF' : '#5fe0b0';
  return (
    <div className="space-y-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><motion.div className="h-full rounded-full" style={{ width: bar, background: color }} /></div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {['12+ characters', 'Upper & lower case', 'A number', 'A symbol'].map((t, i) => (
          <span key={t} className={`flex items-center gap-1.5 transition-colors ${checks[i] ? 'text-glow' : 'text-mist/60'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${checks[i] ? 'bg-glow' : 'bg-mist/30'}`} />{t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Six glowing boxes over one real input (so paste and autofill still work). */
function Otp_Boxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(true);
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input ref={ref} className="absolute inset-0 z-10 w-full cursor-text opacity-0" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus
        aria-label="6-digit code" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      <div className="grid grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => {
          const active = focused && (i === value.length || (i === 5 && value.length === 6));
          const char = value[i];
          return (
            <motion.div key={i} animate={{ scale: active ? 1.05 : 1 }}
              className={`relative flex h-14 items-center justify-center rounded-xl bg-ink/55 font-mono text-2xl text-white ring-1 transition-colors ${active ? 'ring-glow shadow-[0_0_24px_-6px_rgba(127,211,207,0.8)]' : char ? 'ring-glow/30' : 'ring-white/[0.08]'}`}>
              <AnimatePresence>{char && <motion.span initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>{char}</motion.span>}</AnimatePresence>
              {active && !char && <motion.span className="h-6 w-[2px] rounded bg-glow" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} />}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function Spinner() {
  return <motion.span className="relative h-5 w-5 rounded-full border-2 border-ink/30 border-t-ink" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />;
}
