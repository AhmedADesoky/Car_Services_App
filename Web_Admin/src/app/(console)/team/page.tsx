'use client';
import { Fancy_Select } from '@/components/Fancy_Select';
import { motion } from 'motion/react';
import { Copy, KeyRound, PauseCircle, PlayCircle, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { can, useMe } from '@/components/Console_Shell';
import { Field, formatDate, Modal, Page_Header, riseItem, Skeleton, Stagger, Status_Badge, Toast } from '@/components/Ui';
import type { Department, Role, Staff } from '@/lib/Types';
import { api, Api_Problem, problemText, useApi } from '@/lib/Use_Api';

export default function TeamPage() {
  const me = useMe();
  const manage = can(me, 'team.manage');
  const { data: staff, reload } = useApi<Staff[]>('team');
  const { data: roles } = useApi<Role[]>('roles');
  const { data: departments } = useApi<Department[]>('departments');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ email: '', fullName: '', departmentId: '', roleIds: [] as string[] });
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  async function run<T>(path: string, body: unknown, ok: string): Promise<T | null> {
    try {
      const result = await api<T>(path, { method: 'POST', body });
      setToast({ text: ok, tone: 'ok' });
      await reload();
      return result;
    } catch (e) {
      setToast({ text: problemText(e as Api_Problem) ?? 'Error', tone: 'error' });
      return null;
    }
  }

  async function add() {
    const result = await run<{ email: string; temporaryPassword: string }>('team', { ...form, departmentId: form.departmentId || null }, 'Staff account created');
    if (result) {
      setAdding(false);
      setForm({ email: '', fullName: '', departmentId: '', roleIds: [] });
      setSecret({ email: result.email, password: result.temporaryPassword });
    }
  }

  async function reset(s: Staff, resetMfa: boolean) {
    const result = await run<{ temporaryPassword: string }>(`team/${s.id}/reset-password`, { resetMfa }, 'Password reset');
    if (result) setSecret({ email: s.email, password: result.temporaryPassword });
  }

  return (
    <>
      <Page_Header title="Team" subtitle="Company staff who can sign in to this console. 2-step verification is mandatory."
        actions={manage ? <button className="btn btn-primary" onClick={() => setAdding(true)}><UserPlus size={16} /> Add staff</button> : undefined} />

      {!staff ? <Skeleton className="h-80" /> : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <motion.article key={s.id} variants={riseItem} layout className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-glow/10 font-display font-bold text-glow">{s.full_name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</div>
                  <div className="min-w-0"><div className="truncate font-semibold text-white">{s.full_name}</div><div className="truncate text-xs text-mist">{s.email}</div></div>
                </div>
                <Status_Badge status={s.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {s.department && <span className="rounded-full border border-line px-2 py-0.5 text-xs text-fog">{s.department}</span>}
                {s.roles.map((r) => <span key={r.id} className="rounded-full bg-glow/10 px-2 py-0.5 text-xs text-glow">{r.name}</span>)}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-mist">
                {s.mfa_enabled ? <><ShieldCheck size={14} className="text-glow" /> 2FA on</> : <><ShieldOff size={14} className="text-amber" /> 2FA pending</>}
                <span>· last sign-in {formatDate(s.last_login_at)}</span>
              </div>
              {manage && s.id !== me?.id && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.status === 'suspended'
                    ? <button className="btn btn-ghost text-xs" onClick={() => run(`team/${s.id}/reactivate`, {}, 'Reactivated')}><PlayCircle size={14} /> Reactivate</button>
                    : <button className="btn btn-danger text-xs" onClick={() => run(`team/${s.id}/suspend`, {}, 'Suspended and signed out')}><PauseCircle size={14} /> Suspend</button>}
                  <button className="btn btn-ghost text-xs" onClick={() => reset(s, false)}><KeyRound size={14} /> Reset password</button>
                  <button className="btn btn-ghost text-xs" onClick={() => reset(s, true)}><ShieldOff size={14} /> Reset 2FA</button>
                </div>
              )}
            </motion.article>
          ))}
        </Stagger>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add staff member">
        <div className="space-y-4">
          <Field label="Work email"><input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Full name"><input className="field" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
          <Field label="Department"><Fancy_Select theme="dark" value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} options={[{ value: '', label: 'No department' }, ...(departments ?? []).map((d) => ({ value: d.id, label: d.name }))]} /></Field>
          <fieldset><legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-mist">Roles</legend>
            <div className="grid grid-cols-2 gap-2">{roles?.map((r) => (
              <label key={r.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${form.roleIds.includes(r.id) ? 'border-glow bg-glow/10 text-white' : 'border-line text-fog'}`}>
                <input type="checkbox" className="accent-[#7FD3CF]" checked={form.roleIds.includes(r.id)}
                  onChange={(e) => setForm({ ...form, roleIds: e.target.checked ? [...form.roleIds, r.id] : form.roleIds.filter((x) => x !== r.id) })} />{r.name}</label>))}</div>
          </fieldset>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          <button className="btn btn-primary" disabled={!form.email || form.fullName.length < 2 || !form.roleIds.length} onClick={add}>Create account</button></div>
      </Modal>

      <Modal open={!!secret} onClose={() => setSecret(null)} title="Temporary password — shown once">
        <p className="text-sm text-mist">Give it to <b className="text-white">{secret?.email}</b> in person or by phone call. At first sign-in they must choose a new password and turn on 2-step verification.</p>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber/40 bg-amber/5 p-4">
          <code className="select-all font-mono text-lg text-amber">{secret?.password}</code>
          <button className="btn btn-ghost text-xs" onClick={() => secret && navigator.clipboard.writeText(secret.password)}><Copy size={14} /> Copy</button>
        </div>
        <div className="mt-5 flex justify-end"><button className="btn btn-primary" onClick={() => setSecret(null)}>I handed it over</button></div>
      </Modal>
      <Toast message={toast?.text ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}
