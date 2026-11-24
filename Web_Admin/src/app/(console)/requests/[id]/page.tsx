'use client';
import { ArrowLeft, Ban, CheckCircle2, Eye, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { can, useMe } from '@/components/Console_Shell';
import { Field, formatDate, Modal, Page_Header, Skeleton, Status_Badge, Toast } from '@/components/Ui';
import { api, problemText, useApi, Api_Problem } from '@/lib/Use_Api';
import type { Station_Request } from '@/lib/Types';

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const { data: r, reload } = useApi<Station_Request>(`station-requests/${id}`);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  async function act(path: string, body?: unknown, done?: string) {
    try {
      await api(`station-requests/${id}/${path}`, { method: 'POST', body: body ?? {} });
      setToast({ text: done ?? 'Saved', tone: 'ok' });
      setRejecting(false);
      await reload();
    } catch (e) {
      setToast({ text: problemText(e as Api_Problem) ?? 'Error', tone: 'error' });
    }
  }

  if (!r) return <Skeleton className="h-96" />;
  const open = r.status === 'new' || r.status === 'in_review';
  const reviewer = can(me, 'requests.review');

  const rows: [string, string | number | null][] = [
    ['Business (English)', r.business_name], ['Business (Arabic)', r.business_name_ar], ['Plan', r.plan_code], ['City', r.city],
    ['Branches', r.branches_count], ['Workers', r.workers_count], ['Contact', r.contact_name], ['Phone', r.contact_phone],
    ['Email', r.contact_email], ['Language', r.locale === 'ar' ? 'Arabic' : 'English'], ['Received', formatDate(r.created_at)],
    ['Reviewed', r.reviewed_at ? `${formatDate(r.reviewed_at)} by ${r.reviewed_by_name ?? '-'}` : '-'],
  ];

  return (
    <>
      <Link href="/requests" className="mb-4 inline-flex items-center gap-2 text-sm text-mist hover:text-white"><ArrowLeft size={16} /> All requests</Link>
      <Page_Header title={r.business_name} subtitle="Station request" actions={<Status_Badge status={r.status} />} />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="panel p-6">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k}><dt className="text-xs uppercase tracking-wider text-mist">{k}</dt><dd className="mt-1 text-white">{v ?? '-'}</dd></div>
            ))}
          </dl>
          {r.message && (<div className="mt-6 rounded-xl border border-line bg-ink/40 p-4 text-sm text-fog"><div className="mb-1 text-xs uppercase tracking-wider text-mist">Message</div>{r.message}</div>)}
          {r.review_note && (<div className="mt-4 rounded-xl border border-line bg-ink/40 p-4 text-sm text-fog"><div className="mb-1 text-xs uppercase tracking-wider text-mist">Review note</div>{r.review_note}</div>)}
        </section>

        <aside className="panel flex flex-col gap-3 p-6">
          <h2 className="font-display text-lg font-semibold text-white">Decision</h2>
          {!open && r.tenant_id && <Link className="btn btn-ghost" href={`/stations/${r.tenant_id}`}>Open the station</Link>}
          {!open && !r.tenant_id && <p className="text-sm text-mist">This request is closed.</p>}
          {open && reviewer && (
            <>
              {can(me, 'stations.create') && (
                <button className="btn btn-primary" onClick={() => router.push(`/stations/new?request=${r.id}`)}><CheckCircle2 size={16} /> Approve &amp; create station</button>
              )}
              {r.status === 'new' && <button className="btn btn-ghost" onClick={() => act('in-review', undefined, 'Marked as in review')}><Eye size={16} /> Mark in review</button>}
              <button className="btn btn-danger" onClick={() => setRejecting(true)}><XCircle size={16} /> Reject</button>
              <button className="btn btn-ghost" onClick={() => act('spam', undefined, 'Marked as spam')}><Ban size={16} /> Spam</button>
            </>
          )}
          {open && !reviewer && <p className="text-sm text-mist">Your role can view requests but not decide them.</p>}
        </aside>
      </div>

      <Modal open={rejecting} onClose={() => setRejecting(false)} title="Reject request">
        <Field label="Reason (kept in the audit log)"><textarea className="field min-h-28" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setRejecting(false)}>Cancel</button>
          <button className="btn btn-danger" disabled={note.trim().length < 3} onClick={() => act('reject', { note }, 'Request rejected')}>Reject</button>
        </div>
      </Modal>
      <Toast message={toast?.text ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}
