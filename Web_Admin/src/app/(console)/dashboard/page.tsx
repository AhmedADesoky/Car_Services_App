'use client';
import { motion } from 'motion/react';
import { ArrowUpRight, Building2, ClipboardList, Smartphone, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { Animated_Number } from '@/components/Animated_Number';
import { Empty, formatDate, Page_Header, riseItem, Skeleton, Stagger, Status_Badge } from '@/components/Ui';
import { useApi } from '@/lib/Use_Api';

interface Dashboard {
  stationsByStatus: { status: string; count: number }[];
  stationsByPlan: { plan: string; count: number }[];
  requestsByStatus: { status: string; count: number }[];
  monthly: { month: string; stations: number; requests: number }[];
  totals: { active_users: number; invited_users: number; devices: number };
  recentRequests: { id: string; business_name: string; plan_code: string; status: string; created_at: string }[];
}

const sum = (rows: { count: number }[]) => rows.reduce((a, r) => a + r.count, 0);
const pick = (rows: { status: string; count: number }[], s: string) => rows.find((r) => r.status === s)?.count ?? 0;

export default function DashboardPage() {
  const { data, loading } = useApi<Dashboard>('dashboard');

  if (loading || !data) {
    return (<><Page_Header title="Dashboard" subtitle="Platform totals" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div></>);
  }

  const kpis = [
    { label: 'Stations', value: sum(data.stationsByStatus), note: `${pick(data.stationsByStatus, 'active')} active · ${pick(data.stationsByStatus, 'trial')} trial`, icon: Building2, tone: 'text-glow' },
    { label: 'New requests', value: pick(data.requestsByStatus, 'new'), note: `${pick(data.requestsByStatus, 'in_review')} in review`, icon: ClipboardList, tone: 'text-amber' },
    { label: 'Active station users', value: data.totals.active_users, note: `${data.totals.invited_users} invited`, icon: UserCheck, tone: 'text-glow' },
    { label: 'Signed-in devices', value: data.totals.devices, note: 'Android + iOS', icon: Smartphone, tone: 'text-fog' },
  ];
  const maxMonthly = Math.max(1, ...data.monthly.flatMap((m) => [m.stations, m.requests]));
  const planTotal = Math.max(1, sum(data.stationsByPlan));
  const planColor: Record<string, string> = { basic: '#A9BCD3', pro: '#7FD3CF', enterprise: '#F2B544' };

  return (
    <>
      <Page_Header title="Dashboard" subtitle="Totals only — station business data is private to each station"
        actions={<Link href="/requests" className="btn btn-primary">Review requests <ArrowUpRight size={16} /></Link>} />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <motion.div key={k.label} variants={riseItem} whileHover={{ y: -3 }} className="panel relative overflow-hidden p-5">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-glow/5 blur-xl" />
            <div className="flex items-center justify-between text-mist"><span className="text-sm">{k.label}</span><k.icon size={18} className={k.tone} /></div>
            <Animated_Number value={k.value} className={`mt-3 block font-display text-4xl font-bold ${k.tone}`} />
            <div className="mt-1 text-xs text-mist">{k.note}</div>
          </motion.div>
        ))}
      </Stagger>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="panel p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">Last 6 months</h2>
            <div className="flex gap-4 text-xs text-mist">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-glow" /> New stations</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber" /> Requests</span>
            </div>
          </div>
          <div className="flex h-56 items-end gap-3" role="img" aria-label="New stations and requests per month">
            {data.monthly.map((m, i) => (
              <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-48 w-full items-end justify-center gap-1.5">
                  {[{ v: m.stations, c: 'bg-glow' }, { v: m.requests, c: 'bg-amber' }].map((bar, j) => (
                    <motion.div key={j} className={`w-1/3 max-w-6 rounded-t-md ${bar.c}`} title={String(bar.v)}
                      initial={{ height: 0 }} animate={{ height: `${Math.max(2, (bar.v / maxMonthly) * 100)}%` }}
                      transition={{ duration: 0.8, delay: 0.15 + i * 0.07 + j * 0.05, ease: [0.2, 0, 0, 1] }} />
                  ))}
                </div>
                <span className="text-[11px] text-mist">{new Date(`${m.month}-01`).toLocaleString('en-US', { month: 'short' })}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="mb-5 font-display text-lg font-semibold text-white">Plan mix</h2>
          <div className="mb-5 flex h-3 overflow-hidden rounded-full bg-white/5">
            {data.stationsByPlan.map((p, i) => (
              <motion.div key={p.plan} style={{ background: planColor[p.plan] }} initial={{ width: 0 }}
                animate={{ width: `${(p.count / planTotal) * 100}%` }} transition={{ duration: 0.9, delay: 0.2 + i * 0.1, ease: [0.2, 0, 0, 1] }} />
            ))}
          </div>
          <ul className="space-y-3">
            {data.stationsByPlan.map((p) => (
              <li key={p.plan} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 capitalize text-fog"><i className="h-2.5 w-2.5 rounded-full" style={{ background: planColor[p.plan] }} />{p.plan}</span>
                <span className="font-mono text-white">{p.count}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold text-white">Latest requests</h2>
        {data.recentRequests.length === 0 ? (
          <Empty title="No requests yet" text="Requests from the public website's “Request your station” form appear here." />
        ) : (
          <Stagger className="panel divide-y divide-line">
            {data.recentRequests.map((r) => (
              <motion.div key={r.id} variants={riseItem}>
                <Link href={`/requests/${r.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-white">{r.business_name}</div>
                    <div className="text-xs text-mist">{formatDate(r.created_at)} · <span className="capitalize">{r.plan_code}</span></div>
                  </div>
                  <Status_Badge status={r.status} />
                </Link>
              </motion.div>
            ))}
          </Stagger>
        )}
      </section>
    </>
  );
}
