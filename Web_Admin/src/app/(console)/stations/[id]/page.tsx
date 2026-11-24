'use client';
import { Fancy_Select } from '@/components/Fancy_Select';
import { motion } from 'motion/react';
import { ArrowLeft, Lock, Mail, PauseCircle, PlayCircle, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Animated_Number } from '@/components/Animated_Number';
import { can, useMe } from '@/components/Console_Shell';
import { Field, formatDate, Modal, Page_Header, Skeleton, Status_Badge, Toast } from '@/components/Ui';
import type { Station_Detail } from '@/lib/Types';
import { api, Api_Problem, problemText, useApi } from '@/lib/Use_Api';

type Action = 'suspend' | 'reactivate' | 'schedule-deletion' | 'plan' | null;

export default function StationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const { data, reload } = useApi<Station_Detail>(`stations/${id}`);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [plan, setPlan] = useState('');
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  async function run(path: string, body: unknown, method = 'POST', ok = 'Saved') {
    try {
      const result = await api<{ devActivationLink?: string }>(path, { method, body });
      setToast({ text: result?.devActivationLink ? `${ok}. Dev link printed in the backend log.` : ok, tone: 'ok' });
      setAction(null);
      setReason('');
      await reload();
    } catch (e) {
      setToast({ text: problemText(e as Api_Problem) ?? 'Error', tone: 'error' });
    }
  }

  if (!data) return <Skeleton className="h-96" />;
  const s = data.station;
  const inv = data.ownerInvitation;
  const ownerState = !inv ? 'none' : inv.owner_status === 'active' ? 'active' : inv.used_at ? 'active' : new Date(inv.expires_at) < new Date() ? 'expired' : 'invited';

  return (
    <>
      <Link href="/stations" className="mb-4 inline-flex items-center gap-2 text-sm text-mist hover:text-white"><ArrowLeft size={16} /> All stations</Link>
      <Page_Header title={s.display_name} subtitle={`${s.legal_name} · code ${s.station_code}`} actions={<Status_Badge status={s.status} />} />

      <div className="grid gap-4 sm:grid-cols-3">
        {[['Active users', data.counts?.active_users ?? 0], ['Invited users', data.counts?.invited_users ?? 0], ['Devices', data.counts?.devices ?? 0]].map(([label, value], i) => (
          <motion.div key={label as string} className="panel p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <div className="text-sm text-mist">{label}</div>
            <Animated_Number value={value as number} className="mt-2 block font-display text-3xl font-bold text-white" />
          </motion.div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-white">Station details</h2>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 text-sm">
            {[['Plan', `${s.plan_name} (${s.plan_code})`], ['Country / currency', `${s.country} / ${s.currency}`], ['Time zone', s.time_zone],
              ['Language', s.default_locale === 'ar' ? 'Arabic' : 'English'], ['Tax registration', s.tax_reg_no ?? '-'], ['Created', formatDate(s.created_at)],
              ['Contact', s.contact_name ?? '-'], ['Contact phone', s.contact_phone ?? '-'], ['Contact email', s.contact_email ?? '-'],
              ['Deletion scheduled', s.deletion_scheduled_at ? formatDate(s.deletion_scheduled_at) : '-']].map(([k, v]) => (
              <div key={k}><dt className="text-xs uppercase tracking-wider text-mist">{k}</dt><dd className="mt-1 text-white">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-line bg-ink/40 p-4 text-sm text-mist">
            <Lock size={18} className="mt-0.5 shrink-0 text-glow" />
            Customers, cars, orders, payments, worker profiles, faces and locations are private to this station. Support can only see them if the owner grants time-limited access from the app.
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="panel p-6">
            <h2 className="mb-3 font-display text-lg font-semibold text-white">Owner account</h2>
            {inv ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-mist">Username</span><span className="font-mono text-white">{inv.username}</span></div>
                <div className="flex items-center justify-between"><span className="text-mist">Name</span><span className="text-white">{inv.display_name}</span></div>
                <div className="flex items-center justify-between"><span className="text-mist">State</span><Status_Badge status={ownerState === 'expired' ? 'suspended' : ownerState} /></div>
                <div className="flex items-center justify-between"><span className="text-mist">Link expires</span><span className="text-fog">{formatDate(inv.expires_at)}</span></div>
                {ownerState !== 'active' && can(me, 'stations.create') && (
                  <button className="btn btn-ghost mt-3 w-full" onClick={() => run(`stations/${id}/resend-invitation`, {}, 'POST', 'New activation link sent')}><Send size={16} /> Resend invitation</button>
                )}
              </div>
            ) : <p className="text-sm text-mist">No owner invitation.</p>}
          </section>

          <section className="panel flex flex-col gap-2 p-6">
            <h2 className="mb-1 font-display text-lg font-semibold text-white">Actions</h2>
            {can(me, 'stations.update') && <button className="btn btn-ghost" onClick={() => { setPlan(s.plan_code); setAction('plan'); }}><Mail size={16} /> Change plan</button>}
            {can(me, 'stations.suspend') && s.status !== 'suspended' && <button className="btn btn-danger" onClick={() => setAction('suspend')}><PauseCircle size={16} /> Suspend</button>}
            {can(me, 'stations.suspend') && (s.status === 'suspended' || s.status === 'pending_deletion') && <button className="btn btn-ghost" onClick={() => setAction('reactivate')}><PlayCircle size={16} /> Reactivate</button>}
            {can(me, 'stations.delete') && s.status !== 'pending_deletion' && <button className="btn btn-danger" onClick={() => setAction('schedule-deletion')}><Trash2 size={16} /> Schedule deletion (30 days)</button>}
          </section>
        </aside>
      </div>

      <Modal open={action === 'plan'} onClose={() => setAction(null)} title="Change plan">
        <Field label="Plan"><Fancy_Select theme="dark" value={plan} onChange={(v) => setPlan(v)} options={[{ value: 'basic', label: 'Basic' }, { value: 'pro', label: 'Pro' }, { value: 'enterprise', label: 'Enterprise' }]} /></Field>
        <div className="mt-4 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setAction(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => run(`stations/${id}`, { planCode: plan }, 'PATCH', 'Plan changed')}>Save</button></div>
      </Modal>
      <Modal open={action === 'suspend' || action === 'reactivate' || action === 'schedule-deletion'} onClose={() => setAction(null)}
        title={action === 'suspend' ? 'Suspend station' : action === 'reactivate' ? 'Reactivate station' : 'Schedule deletion'}>
        <p className="mb-4 text-sm text-mist">
          {action === 'suspend' ? 'Everyone at this station is signed out immediately. Data is kept unchanged.' : action === 'schedule-deletion'
            ? 'The station is blocked now and its data is destroyed after 30 days (owner can export before). This can be undone during the 30 days.' : 'The station can sign in again.'}
        </p>
        <Field label="Reason (kept in the audit log)"><textarea className="field min-h-24" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="mt-4 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setAction(null)}>Cancel</button>
          <button className={action === 'reactivate' ? 'btn btn-primary' : 'btn btn-danger'} disabled={reason.trim().length < 3}
            onClick={() => run(`stations/${id}/${action}`, { reason }, 'POST', 'Station updated')}>Confirm</button></div>
      </Modal>
      <Toast message={toast?.text ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}
