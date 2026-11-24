'use client';
import { Fancy_Select } from '@/components/Fancy_Select';
import { AnimatePresence, motion } from 'motion/react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { formatDate, Page_Header, Skeleton } from '@/components/Ui';
import type { Audit_Row } from '@/lib/Types';
import { api, useApi } from '@/lib/Use_Api';

export default function AuditPage() {
  const [action, setAction] = useState('');
  const { data, setData } = useApi<Audit_Row[]>(`audit-logs${action ? `?action=${encodeURIComponent(action)}` : ''}`);
  const [verify, setVerify] = useState<{ checked: number; brokenAt: number | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [more, setMore] = useState(true);

  async function loadMore() {
    if (!data?.length) return;
    const next = await api<Audit_Row[]>(`audit-logs?before=${data[data.length - 1].seq}${action ? `&action=${encodeURIComponent(action)}` : ''}`);
    setMore(next.length === 100);
    setData([...data, ...next]);
  }

  return (
    <>
      <Page_Header title="Audit log" subtitle="Append-only and hash-chained: any edit or deletion in the database breaks the chain."
        actions={<button className="btn btn-ghost" disabled={checking} onClick={async () => { setChecking(true); setVerify(await api('audit-logs/verify')); setChecking(false); }}>
          <ShieldCheck size={16} /> {checking ? 'Verifying…' : 'Verify chain'}</button>} />

      <AnimatePresence>
        {verify && (
          <motion.div initial={{ opacity: 0, y: -8, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0 }}
            className={`mb-5 flex items-center gap-3 rounded-2xl border p-4 ${verify.brokenAt === null ? 'border-teal/50 bg-teal/10 text-glow' : 'border-danger/50 bg-danger/10 text-[#ffb3b3]'}`}>
            {verify.brokenAt === null ? <ShieldCheck /> : <ShieldAlert />}
            {verify.brokenAt === null ? `Chain intact — ${verify.checked} entries verified.` : `Chain broken at entry #${verify.brokenAt}. Investigate immediately.`}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-4 max-w-xs"><Fancy_Select theme="dark" label="Filter by action" value={action} onChange={(v) => setAction(v)} options={[{ value: '', label: 'All actions' }, { value: 'station.', label: 'Stations' }, { value: 'request.', label: 'Requests' }, { value: 'staff.', label: 'Staff' }, { value: 'role.', label: 'Roles' }, { value: 'plan.', label: 'Plans' }, { value: 'session.', label: 'Sign-ins' }]} /></div>

      {!data ? <Skeleton className="h-96" /> : (
        <ol className="relative space-y-2 border-l border-line pl-6">
          {data.map((row, i) => (
            <motion.li key={row.seq} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}
              className="panel relative p-4">
              <span className="absolute -left-[31px] top-5 h-3 w-3 rounded-full border-2 border-ink bg-glow" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm text-glow">{row.action}</span>
                <span className="text-xs text-mist">#{row.seq} · {formatDate(row.at)}</span>
              </div>
              <div className="mt-1 text-sm text-fog">{row.actor_email ?? 'system'} → {row.target_type} <span className="font-mono text-xs text-mist">{row.target_id?.slice(0, 13)}</span></div>
              {Object.keys(row.details ?? {}).length > 0 && <pre className="mt-2 overflow-x-auto rounded-lg bg-ink/50 p-2 font-mono text-[11px] text-mist">{JSON.stringify(row.details)}</pre>}
            </motion.li>
          ))}
        </ol>
      )}
      {data && data.length >= 100 && more && <div className="mt-4 flex justify-center"><button className="btn btn-ghost" onClick={loadMore}>Load older</button></div>}
    </>
  );
}
