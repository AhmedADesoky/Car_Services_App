'use client';
import { AnimatePresence, motion } from 'motion/react';
import { Check, KeyRound, Smartphone, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { Brand_Glyph } from '@/components/Site_Chrome';
import { isLocale } from '@/config/Brand_Config';
import { DICTIONARIES } from '@/i18n/Dictionary';

const API = process.env.NEXT_PUBLIC_STATION_API_URL ?? 'http://localhost:3000/v1';

interface Invitation { stationName: string; stationCode: string; username: string; displayName: string; passwordMinLength: number }

function Activate() {
  const { locale } = useParams<{ locale: string }>();
  const t = DICTIONARIES[isLocale(locale) ? locale : 'ar'].activate;
  const searchParams = useSearchParams();
  // Read the one-time token ONCE, then it is removed from the address bar (history, screenshots, shoulder-surfing).
  const [token] = useState(() => searchParams.get('token') ?? '');
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [state, setState] = useState<'checking' | 'invalid' | 'ready' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Remove the token from the address bar / history as soon as we read it.
    if (token) window.history.replaceState(null, '', window.location.pathname);
    if (!token) { setState('invalid'); return; }
    fetch(`${API}/public/invitations/${encodeURIComponent(token)}`)
      .then(async (r) => { if (!r.ok) throw new Error(); setInvite(await r.json()); setState('ready'); })
      .catch(() => setState('invalid'));
  }, [token]); // token never changes after the first render

  const checks = useMemo(() => {
    const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
    return [
      password.length >= (invite?.passwordMinLength ?? 10),
      kinds >= 3,
      !!invite && password.length > 0 && !password.toLowerCase().includes(invite.username.toLowerCase()),
    ];
  }, [password, invite]);
  const strength = checks.filter(Boolean).length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError(t.mismatch); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${API}/public/invitations/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
      if (r.status === 410) { setState('invalid'); return; }
      if (!r.ok) { const body = await r.json().catch(() => ({})); setError(body.detail ?? 'Error'); return; }
      setState('done');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy px-5 py-16">
      <div className="pointer-events-none absolute -top-40 end-[-10%] h-[480px] w-[480px] rounded-full bg-teal/40 blur-[120px]" />
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="relative w-full max-w-md rounded-[32px] bg-white p-8 shadow-2xl">
        <Link href={`/${locale}`} className="mb-6 inline-flex"><Brand_Glyph /></Link>
        <AnimatePresence mode="wait">
          {state === 'checking' && <motion.p key="c" exit={{ opacity: 0 }} className="text-mist">{t.checking}</motion.p>}
          {state === 'invalid' && (
            <motion.div key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange/15 text-orange"><X size={30} /></div>
              <p className="mt-4 text-ink">{t.invalid}</p>
            </motion.div>
          )}
          {state === 'ready' && invite && (
            <motion.form key="r" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-navy">{t.title}</h1>
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-paper p-4 text-sm">
                <div><div className="text-mist">{t.station}</div><div className="font-semibold text-navy">{invite.stationName}</div></div>
                <div><div className="text-mist">{t.username}</div><div className="font-mono font-semibold text-navy" dir="ltr">{invite.username}</div></div>
              </div>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">{t.password}</span>
                <input className="input" type="password" autoComplete="new-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></label>
              <div className="flex gap-1.5" aria-hidden="true">{[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 flex-1 rounded-full" animate={{ backgroundColor: i < strength ? ['#E8833A', '#F2B544', '#0E8A86'][strength - 1] : '#DCE3EA' }} />)}</div>
              <ul className="space-y-1 text-sm">{t.rules.map((rule, i) => (
                <li key={rule} className={`flex items-center gap-2 ${checks[i] ? 'text-teal' : 'text-mist'}`}><Check size={14} className={checks[i] ? '' : 'opacity-30'} />{rule}</li>))}</ul>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">{t.confirm}</span>
                <input className="input" type="password" autoComplete="new-password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
              {error && <p role="alert" className="rounded-xl bg-orange/10 px-4 py-2 text-sm font-semibold text-[#8A3D0C]">{error}</p>}
              <button type="submit" className="btn btn-navy w-full" disabled={busy || strength < 3 || !confirm}><KeyRound size={18} />{t.submit}</button>
            </motion.form>
          )}
          {state === 'done' && invite && (
            <motion.div key="d" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
              <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-teal text-white"><Check size={40} strokeWidth={3} /></motion.div>
              <h1 className="mt-5 font-display text-2xl font-bold text-navy">{t.doneTitle}</h1>
              <p className="mt-2 text-mist">{t.doneText}</p>
              <div className="mt-5 rounded-2xl bg-paper p-4"><div className="text-sm text-mist">{t.code}</div><div className="font-mono text-3xl font-bold tracking-widest text-navy" dir="ltr">{invite.stationCode}</div></div>
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-mist"><Smartphone size={16} />Android · iOS</div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

export default function ActivatePage() {
  return <Suspense><Activate /></Suspense>;
}
