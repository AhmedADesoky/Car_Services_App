'use client';
import { motion } from 'motion/react';
import { Building2, MapPin, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Empty, formatDate, Page_Header, riseItem, Skeleton, Stagger, Status_Badge } from '@/components/Ui';
import { useApi } from '@/lib/Use_Api';
import type { Station_Request } from '@/lib/Types';


const TABS = [
  { key: 'new', label: 'New' }, { key: 'in_review', label: 'In review' }, { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' }, { key: '', label: 'All' },
];

export default function RequestsPage() {
  const [tab, setTab] = useState('new');
  const { data, loading } = useApi<Station_Request[]>(`station-requests${tab ? `?status=${tab}` : ''}`);

  return (
    <>
      <Page_Header title="Station requests" subtitle="From the public website. Approving one creates the station and invites its owner." />
      <div className="mb-5 flex flex-wrap gap-1 rounded-2xl border border-line bg-deep/60 p-1" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`relative min-h-10 rounded-xl px-4 text-sm font-medium ${tab === t.key ? 'text-ink' : 'text-mist hover:text-white'}`}>
            {tab === t.key && <motion.span layoutId="req-tab" className="absolute inset-0 rounded-xl bg-glow" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : !data?.length ? (
        <Empty title="Nothing here" text="When businesses fill in “Request your station” on the public website, they show up in New." />
      ) : (
        <Stagger key={tab} className="grid gap-4 md:grid-cols-2">
          {data.map((r) => (
            <motion.div key={r.id} variants={riseItem} whileHover={{ y: -3 }}>
              <Link href={`/requests/${r.id}`} className="panel block p-5 transition-colors hover:border-glow/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg font-semibold text-white">{r.business_name}</div>
                    {r.business_name_ar && <div className="truncate text-sm text-mist" dir="rtl">{r.business_name_ar}</div>}
                  </div>
                  <Status_Badge status={r.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-mist">
                  <span className="flex items-center gap-1.5"><Building2 size={14} /> {r.branches_count} branches</span>
                  <span className="flex items-center gap-1.5"><Users size={14} /> {r.workers_count} workers</span>
                  {r.city && <span className="flex items-center gap-1.5"><MapPin size={14} /> {r.city}</span>}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-mist">
                  <span>{r.contact_name} · {formatDate(r.created_at)}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 capitalize text-fog">{r.plan_code}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </Stagger>
      )}
    </>
  );
}
