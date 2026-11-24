'use client';
import { Fancy_Select } from '@/components/Fancy_Select';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Copy, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Field, Modal, Page_Header } from '@/components/Ui';
import type { Station_Request } from '@/lib/Types';
import { api, Api_Problem, problemText } from '@/lib/Use_Api';

interface Form {
  stationCode: string; legalName: string; displayName: string; taxRegNo: string; defaultLocale: 'ar' | 'en'; planCode: 'basic' | 'pro' | 'enterprise';
  status: 'trial' | 'active'; contactName: string; contactPhone: string; contactEmail: string; ownerName: string; ownerUsername: string; ownerPhone: string;
}
const EMPTY: Form = {
  stationCode: '', legalName: '', displayName: '', taxRegNo: '', defaultLocale: 'ar', planCode: 'pro', status: 'trial',
  contactName: '', contactPhone: '', contactEmail: '', ownerName: '', ownerUsername: 'owner', ownerPhone: '',
};
const STEPS = ['Business', 'Owner', 'Plan & review'];
const suggestCode = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

function NewStation() {
  const params = useSearchParams();
  const router = useRouter();
  const requestId = params.get('request');
  const [form, setForm] = useState<Form>(EMPTY);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ stationId: string; ownerUsername: string; devActivationLink?: string; invitationExpiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!requestId) return;
    api<Station_Request>(`station-requests/${requestId}`).then((r) => setForm((f) => ({
      ...f, legalName: r.business_name, displayName: r.business_name, stationCode: suggestCode(r.business_name),
      planCode: r.plan_code as Form['planCode'], defaultLocale: r.locale as Form['defaultLocale'],
      contactName: r.contact_name, contactPhone: r.contact_phone, contactEmail: r.contact_email ?? '', ownerName: r.contact_name, ownerPhone: r.contact_phone,
    }))).catch(() => setError('Could not load the request'));
  }, [requestId]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const valid = [
    /^[A-Z0-9]{4,12}$/.test(form.stationCode) && form.legalName.trim().length > 1 && form.displayName.trim().length > 1 && form.contactName.trim().length > 1 && /^\+?[0-9 ]{8,20}$/.test(form.contactPhone),
    form.ownerName.trim().length > 1 && /^[a-z][a-z0-9._-]{2,31}$/.test(form.ownerUsername) && /^\+?[0-9 ]{8,20}$/.test(form.ownerPhone),
    true,
  ];
  const go = (to: number) => { setDir(to > step ? 1 : -1); setStep(to); };

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<NonNullable<typeof done>>('stations', { method: 'POST', body: {
        stationCode: form.stationCode, legalName: form.legalName, displayName: form.displayName, taxRegNo: form.taxRegNo || undefined,
        defaultLocale: form.defaultLocale, planCode: form.planCode, status: form.status,
        contact: { name: form.contactName, phone: form.contactPhone, email: form.contactEmail || undefined },
        owner: { fullName: form.ownerName, username: form.ownerUsername, phone: form.ownerPhone }, requestId: requestId ?? undefined,
      } });
      setDone(result);
    } catch (e) {
      setError(problemText(e as Api_Problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href={requestId ? `/requests/${requestId}` : '/stations'} className="mb-4 inline-flex items-center gap-2 text-sm text-mist hover:text-white"><ArrowLeft size={16} /> Back</Link>
      <Page_Header title="New station" subtitle={requestId ? 'Approving a request from the public website' : 'Create a station and invite its owner'} />

      <ol className="mb-6 grid grid-cols-3 gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="relative overflow-hidden rounded-xl border border-line bg-deep/60 px-4 py-3">
            <motion.div className="absolute inset-y-0 left-0 bg-glow/15" initial={false} animate={{ width: i < step ? '100%' : i === step ? '50%' : '0%' }} transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }} />
            <span className={`relative flex items-center gap-2 text-sm font-medium ${i <= step ? 'text-white' : 'text-mist'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${i < step ? 'bg-glow text-ink' : 'border border-line'}`}>{i < step ? <Check size={14} /> : i + 1}</span>{label}
            </span>
          </li>
        ))}
      </ol>

      <section className="panel overflow-hidden p-6">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={step} custom={dir} initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }} transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            className="grid gap-5 md:grid-cols-2">
            {step === 0 && (<>
              <Field label="Display name"><input className="field" value={form.displayName} onChange={(e) => { set('displayName', e.target.value); if (!form.stationCode) set('stationCode', suggestCode(e.target.value)); }} /></Field>
              <Field label="Legal name"><input className="field" value={form.legalName} onChange={(e) => set('legalName', e.target.value)} /></Field>
              <Field label="Station code" hint="4–12 letters/digits. Workers type it once to connect their phone.">
                <input className="field font-mono uppercase" value={form.stationCode} onChange={(e) => set('stationCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))} /></Field>
              <Field label="Tax registration no. (optional)"><input className="field" value={form.taxRegNo} onChange={(e) => set('taxRegNo', e.target.value)} /></Field>
              <Field label="Business contact name"><input className="field" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} /></Field>
              <Field label="Business contact phone"><input className="field" inputMode="tel" placeholder="+965 xxxx xxxx" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} /></Field>
              <Field label="Business email (optional)"><input className="field" type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} /></Field>
              <Field label="Default language">
                <Fancy_Select theme="dark" value={form.defaultLocale} onChange={(v) => set('defaultLocale', v as Form['defaultLocale'])} options={[{ value: 'ar', label: 'Arabic' }, { value: 'en', label: 'English' }]} /></Field>
            </>)}
            {step === 1 && (<>
              <Field label="Owner full name"><input className="field" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} /></Field>
              <Field label="Owner username" hint="Lowercase. The owner signs in with station code + this username.">
                <input className="field font-mono" value={form.ownerUsername} onChange={(e) => set('ownerUsername', e.target.value.toLowerCase())} /></Field>
              <Field label="Owner mobile (receives the activation link)"><input className="field" inputMode="tel" placeholder="+965 xxxx xxxx" value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} /></Field>
              <div className="rounded-xl border border-glow/25 bg-glow/5 p-4 text-sm text-fog md:col-span-2">
                No password is created here. The owner receives a <b className="text-white">one-time activation link (48 h)</b> and chooses their own password; nobody at the company ever knows it.
              </div>
            </>)}
            {step === 2 && (<>
              <div className="grid gap-3 md:col-span-2 md:grid-cols-3" role="radiogroup" aria-label="Plan">
                {(['basic', 'pro', 'enterprise'] as const).map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={form.planCode === p} onClick={() => set('planCode', p)}
                    className={`relative rounded-2xl border p-4 text-left transition-colors ${form.planCode === p ? 'border-glow bg-glow/10' : 'border-line hover:border-glow/40'}`}>
                    {form.planCode === p && <motion.span layoutId="plan-pick" className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-glow text-ink"><Check size={14} /></motion.span>}
                    <div className="font-display text-lg font-semibold capitalize text-white">{p}</div>
                    <div className="mt-1 text-xs text-mist">{p === 'basic' ? '1 branch · 10 workers' : p === 'pro' ? '5 branches · 50 workers · AI fine-tuning' : 'Unlimited · dedicated DB option'}</div>
                  </button>
                ))}
              </div>
              <Field label="Start as">
                <Fancy_Select theme="dark" value={form.status} onChange={(v) => set('status', v as Form['status'])} options={[{ value: 'trial', label: 'Trial' }, { value: 'active', label: 'Active (paid)' }]} /></Field>
              <dl className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-ink/40 p-4 text-sm md:col-span-2">
                {[['Station', `${form.displayName} (${form.stationCode})`], ['Legal name', form.legalName], ['Owner', `${form.ownerName} · ${form.ownerUsername}`], ['Owner mobile', form.ownerPhone], ['Plan', form.planCode[0].toUpperCase() + form.planCode.slice(1)], ['Language', form.defaultLocale === 'ar' ? 'Arabic' : 'English']].map(([k, v]) => (
                  <div key={k}><dt className="text-xs uppercase tracking-wider text-mist">{k}</dt><dd className="text-white">{v}</dd></div>
                ))}
              </dl>
            </>)}
          </motion.div>
        </AnimatePresence>
        {error && <p role="alert" className="mt-5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-[#ffb3b3]">{error}</p>}
        <div className="mt-6 flex justify-between">
          <button className="btn btn-ghost" disabled={step === 0} onClick={() => go(step - 1)}><ArrowLeft size={16} /> Back</button>
          {step < 2
            ? <button className="btn btn-primary" disabled={!valid[step]} onClick={() => go(step + 1)}>Next <ArrowRight size={16} /></button>
            : <button className="btn btn-primary" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create station & send invitation'}</button>}
        </div>
      </section>

      <Modal open={!!done} onClose={() => router.push(`/stations/${done?.stationId}`)} title="Station created">
        <motion.div initial={{ scale: 0.6, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-glow/15 text-glow"><PartyPopper size={28} /></motion.div>
        <p className="text-fog">The owner <b className="text-white">{done?.ownerUsername}</b> received an activation link by SMS. It is valid until {done ? new Date(done.invitationExpiresAt).toLocaleString() : ''}.</p>
        {done?.devActivationLink && (
          <div className="mt-4 rounded-xl border border-amber/40 bg-amber/5 p-3 text-xs text-amber">
            <div className="mb-2 font-semibold">Development only — the link is shown because no SMS provider is configured:</div>
            <code className="block break-all font-mono text-fog">{done.devActivationLink}</code>
            <button className="btn btn-ghost mt-2 text-xs" onClick={() => { void navigator.clipboard.writeText(done.devActivationLink!); setCopied(true); }}><Copy size={14} /> {copied ? 'Copied' : 'Copy link'}</button>
          </div>
        )}
        <div className="mt-5 flex justify-end"><button className="btn btn-primary" onClick={() => router.push(`/stations/${done?.stationId}`)}>Open station</button></div>
      </Modal>
    </>
  );
}

export default function NewStationPage() {
  return <Suspense><NewStation /></Suspense>;
}
