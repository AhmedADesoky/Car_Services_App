'use client';
import { motion } from 'motion/react';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { can, useMe } from '@/components/Console_Shell';
import { Field, Modal, Page_Header, riseItem, Skeleton, Stagger, Toast } from '@/components/Ui';
import type { Plan } from '@/lib/Types';
import { api, Api_Problem, problemText, useApi } from '@/lib/Use_Api';

const LIMIT_LABEL: Record<string, string> = {
  branches: 'Branches', workers: 'Active workers', plate_scans_month: 'Plate scans / month', fine_tune: 'AI fine-tuning', custom_roles: 'Custom roles', import: 'Excel import',
};
const show = (v: unknown) => (v === null || v === undefined ? 'Unlimited' : v === true ? 'Yes' : v === false ? 'No' : String(v));

export default function PlansPage() {
  const me = useMe();
  const { data, reload } = useApi<Plan[]>('plans');
  const [editing, setEditing] = useState<Plan | null>(null);
  const [price, setPrice] = useState('');
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  async function save() {
    if (!editing) return;
    try {
      await api(`plans/${editing.code}`, { method: 'PATCH', body: { priceMonthly: Number(price) } });
      setEditing(null);
      setToast({ text: 'Plan updated', tone: 'ok' });
      await reload();
    } catch (e) {
      setToast({ text: problemText(e as Api_Problem) ?? 'Error', tone: 'error' });
    }
  }

  return (
    <>
      <Page_Header title="Plans & billing" subtitle="Limits are enforced per station by the API (seats, branches, plate scans)." />
      {!data ? <Skeleton className="h-80" /> : (
        <Stagger className="grid gap-4 lg:grid-cols-3">
          {data.map((p) => (
            <motion.article key={p.code} variants={riseItem} whileHover={{ y: -4 }}
              className={`panel relative overflow-hidden p-6 ${p.code === 'pro' ? 'border-glow/50' : ''}`}>
              {p.code === 'pro' && <span className="absolute right-4 top-4 rounded-full bg-glow px-2.5 py-0.5 text-xs font-bold text-ink">Most chosen</span>}
              <h2 className="font-display text-2xl font-bold text-white">{p.name}</h2>
              <div className="mt-2 flex items-baseline gap-1"><span className="font-display text-4xl font-bold text-glow">{Number(p.price_monthly).toLocaleString()}</span><span className="text-mist">{p.currency} / month</span></div>
              <div className="mt-1 text-xs text-mist">{p.stations} station(s) on this plan</div>
              <ul className="mt-5 space-y-2 text-sm">
                {Object.entries(LIMIT_LABEL).map(([key, label]) => (
                  <li key={key} className="flex justify-between border-b border-line/60 pb-2"><span className="text-mist">{label}</span><span className="text-white">{show(p.limits[key])}</span></li>
                ))}
              </ul>
              {can(me, 'plans.manage') && <button className="btn btn-ghost mt-5 w-full" onClick={() => { setEditing(p); setPrice(p.price_monthly); }}><Pencil size={16} /> Edit price</button>}
            </motion.article>
          ))}
        </Stagger>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ''}`}>
        <Field label="Monthly price (EGP)"><input className="field" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <div className="mt-4 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></div>
      </Modal>
      <Toast message={toast?.text ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}
