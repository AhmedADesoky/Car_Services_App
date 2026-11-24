'use client';
import { Fancy_Select } from '@/components/Fancy_Select';
import { motion } from 'motion/react';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { can, useMe } from '@/components/Console_Shell';
import { Empty, formatDate, Page_Header, riseItem, Skeleton, Status_Badge } from '@/components/Ui';
import type { Station_Row } from '@/lib/Types';
import { useApi } from '@/lib/Use_Api';

export default function StationsPage() {
  const me = useMe();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const query = useDeferredValue(new URLSearchParams(Object.entries({ q, status, plan }).filter(([, v]) => v)).toString());
  const { data, loading } = useApi<Station_Row[]>(`stations${query ? `?${query}` : ''}`);

  return (
    <>
      <Page_Header title="Stations" subtitle="Usage totals per station. Customers, orders and money stay private to each station."
        actions={can(me, 'stations.create') ? <Link href="/stations/new" className="btn btn-primary"><Plus size={16} /> New station</Link> : undefined} />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px_180px]">
        <label className="relative"><span className="sr-only">Search</span>
          <Search size={16} className="absolute left-3 top-3.5 text-mist" />
          <input className="field pl-9" placeholder="Search by name or station code" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Fancy_Select theme="dark" label="Status" value={status} onChange={(v) => setStatus(v)} options={[{ value: '', label: 'All statuses' }, { value: 'trial', label: 'Trial' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'pending_deletion', label: 'Pending deletion' }]} />
        <Fancy_Select theme="dark" label="Plan" value={plan} onChange={(v) => setPlan(v)} options={[{ value: '', label: 'All plans' }, { value: 'basic', label: 'Basic' }, { value: 'pro', label: 'Pro' }, { value: 'enterprise', label: 'Enterprise' }]} />
      </div>

      {loading && !data ? <Skeleton className="h-80" /> : !data?.length ? (
        <Empty title="No stations found" text="Create a station from an approved request, or with “New station”." />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-mist">
              <tr className="border-b border-line">
                {['Station', 'Code', 'Plan', 'Status', 'Users', 'Devices', 'Plate scans (month)', 'Created'].map((h) => <th key={h} className="px-5 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <motion.tbody key={query} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}>
              {data.map((s) => (
                <motion.tr key={s.id} variants={riseItem} className="border-b border-line/60 last:border-0 hover:bg-white/[0.03]">
                  <td className="px-5 py-3.5"><Link href={`/stations/${s.id}`} className="font-medium text-white hover:text-glow">{s.display_name}</Link></td>
                  <td className="px-5 font-mono text-fog">{s.station_code}</td>
                  <td className="px-5 capitalize text-fog">{s.plan}</td>
                  <td className="px-5"><Status_Badge status={s.status} /></td>
                  <td className="px-5 font-mono text-fog">{s.active_users}<span className="text-mist"> (+{s.invited_users})</span></td>
                  <td className="px-5 font-mono text-fog">{s.devices}</td>
                  <td className="px-5 font-mono text-fog">{s.plate_scans_month}</td>
                  <td className="px-5 text-mist">{formatDate(s.created_at)}</td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      )}
    </>
  );
}
