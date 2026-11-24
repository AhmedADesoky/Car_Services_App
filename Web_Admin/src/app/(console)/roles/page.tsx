'use client';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Lock, Plus, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { can, useMe } from '@/components/Console_Shell';
import { Field, Modal, Page_Header, Skeleton, Toast } from '@/components/Ui';
import type { Department, Permission, Role } from '@/lib/Types';
import { api, Api_Problem, problemText, useApi } from '@/lib/Use_Api';

export default function RolesPage() {
  const me = useMe();
  const manage = can(me, 'roles.manage');
  const { data: roles, reload } = useApi<Role[]>('roles');
  const { data: permissions } = useApi<Permission[]>('permissions');
  const { data: departments } = useApi<Department[]>('departments');
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const role = roles?.find((r) => r.id === selected) ?? roles?.[0];
  useEffect(() => { if (role) setDraft(new Set(role.permissions)); }, [role?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    permissions?.forEach((p) => map.set(p.category, [...(map.get(p.category) ?? []), p]));
    return [...map.entries()];
  }, [permissions]);
  const locked = !manage || role?.name === 'Super Admin';
  const dirty = role && (draft.size !== role.permissions.length || role.permissions.some((p) => !draft.has(p)));

  async function save() {
    if (!role) return;
    try {
      await api(`roles/${role.id}/permissions`, { method: 'PUT', body: { permissions: [...draft] } });
      setToast({ text: 'Permissions saved — members get them on their next request', tone: 'ok' });
      await reload();
    } catch (e) { setToast({ text: problemText(e as Api_Problem) ?? 'Error', tone: 'error' }); }
  }
  async function create() {
    try {
      const created = await api<{ id: string }>('roles', { method: 'POST', body: { ...newRole, permissions: [] } });
      setCreating(false);
      setNewRole({ name: '', description: '' });
      await reload();
      setSelected(created.id);
    } catch (e) { setToast({ text: problemText(e as Api_Problem) ?? 'Error', tone: 'error' }); }
  }

  return (
    <>
      <Page_Header title="Roles & access" subtitle="Company departments and what each role may do. Every change is audited and takes effect immediately."
        actions={manage ? <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} /> New role</button> : undefined} />
      {!roles || !permissions ? <Skeleton className="h-96" /> : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <nav className="panel p-2" aria-label="Roles">
              {roles.map((r) => (
                <button key={r.id} onClick={() => setSelected(r.id)} className={`relative flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left text-sm ${role?.id === r.id ? 'text-white' : 'text-mist hover:text-white'}`}>
                  {role?.id === r.id && <motion.span layoutId="role-pick" className="absolute inset-0 rounded-xl bg-glow/10 ring-1 ring-glow/30" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span className="relative flex items-center gap-2">{r.is_system && <Lock size={13} className="text-mist" />}{r.name}</span>
                  <span className="relative text-xs text-mist">{r.members} · {r.permissions.length}</span>
                </button>
              ))}
            </nav>
            <section className="panel p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-mist">Departments</h3>
              <ul className="space-y-1.5 text-sm">{departments?.map((d) => <li key={d.id} className="flex justify-between text-fog"><span>{d.name}</span><span className="text-mist">{d.members}</span></li>)}</ul>
            </section>
          </div>

          <section className="panel p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-display text-xl font-semibold text-white">{role?.name}</h2><p className="text-sm text-mist">{role?.description}</p></div>
              <AnimatePresence>{dirty && !locked && (
                <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="btn btn-primary" onClick={save}><Save size={16} /> Save changes</motion.button>
              )}</AnimatePresence>
            </div>
            {role?.name === 'Super Admin' && <p className="mb-4 rounded-xl border border-line bg-ink/40 p-3 text-sm text-mist">Super Admin always has every permission and cannot be reduced.</p>}
            <div className="space-y-6">
              {grouped.map(([category, items]) => (
                <div key={category}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-mist">{category}</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map((p) => {
                      const on = draft.has(p.code);
                      const grantable = me?.permissions.includes(p.code);
                      return (
                        <button key={p.code} type="button" disabled={locked || !grantable} aria-pressed={on}
                          onClick={() => setDraft((d) => { const n = new Set(d); if (n.has(p.code)) n.delete(p.code); else n.add(p.code); return n; })}
                          className={`flex min-h-14 items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed ${on ? 'border-glow/50 bg-glow/10' : 'border-line hover:border-glow/30'} ${locked ? 'opacity-80' : ''}`}>
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-glow bg-glow text-ink' : 'border-line'}`}>
                            <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={13} /></motion.span>}</AnimatePresence>
                          </span>
                          <span><span className="block font-mono text-xs text-glow">{p.code}</span><span className="text-fog">{p.description}</span></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="New role">
        <div className="space-y-4">
          <Field label="Name"><input className="field" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} /></Field>
          <Field label="Description"><input className="field" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button><button className="btn btn-primary" disabled={newRole.name.trim().length < 2} onClick={create}>Create</button></div>
      </Modal>
      <Toast message={toast?.text ?? null} tone={toast?.tone} onDone={() => setToast(null)} />
    </>
  );
}
