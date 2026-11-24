'use client';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { ReactNode, useEffect } from 'react';

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-teal/15 text-glow border-teal/40',
  trial: 'bg-amber/10 text-amber border-amber/40',
  suspended: 'bg-orange/10 text-orange border-orange/40',
  pending_deletion: 'bg-danger/10 text-danger border-danger/40',
  invited: 'bg-amber/10 text-amber border-amber/40',
  new: 'bg-glow/15 text-glow border-glow/50',
  in_review: 'bg-amber/10 text-amber border-amber/40',
  approved: 'bg-teal/15 text-glow border-teal/40',
  rejected: 'bg-white/5 text-mist border-line',
  spam: 'bg-white/5 text-mist border-line',
  deactivated: 'bg-white/5 text-mist border-line',
};

export function Status_Badge({ status }: { status: string }) {
  const live = status === 'new';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? 'border-line text-mist'}`}>
      {live && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-glow opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-glow" />
        </span>
      )}
      {status.replace('_', ' ')}
    </span>
  );
}

export function Page_Header({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mist">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.div>
  );
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}>
      {children}
    </motion.div>
  );
}

export const riseItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.2, 0, 0, 1] as const } },
};

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={title}
            className={`panel w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto p-6`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-white">{title}</h2>
              <button className="rounded-lg p-2 text-mist hover:bg-white/5 hover:text-white" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toast({ message, onDone, tone = 'ok' }: { message: string | null; onDone: () => void; tone?: 'ok' | 'error' }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <AnimatePresence>
      {message && (
        <motion.div role="status" className={`fixed bottom-6 right-6 z-[60] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-2xl ${tone === 'ok' ? 'border-teal/50 bg-deep text-glow' : 'border-danger/50 bg-deep text-[#ffb3b3]'}`}
          initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}>
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-mist">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-mist/70">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-[#ffb3b3]">{error}</span>}
    </label>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} />;
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="panel flex flex-col items-center gap-2 p-10 text-center">
      <div className="font-display text-lg font-semibold text-white">{title}</div>
      <p className="max-w-md text-sm text-mist">{text}</p>
    </div>
  );
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
