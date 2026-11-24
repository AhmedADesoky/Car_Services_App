'use client';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, RotateCcw, Sparkles, X } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import type { Locale } from '@/config/Brand_Config';
import type { Dictionary } from '@/i18n/Dictionary';

const API = process.env.NEXT_PUBLIC_STATION_API_URL ?? 'http://localhost:3000/v1';
const ease = [0.2, 0, 0, 1] as const;
type Turn = { role: 'user' | 'assistant'; content: string; local?: boolean };

/** Offline fallback: pick the FAQ answer that shares the most words with the question. */
function localAnswer(t: Dictionary, question: string) {
  const words = (s: string) => new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2));
  const q = words(question);
  let best = { score: 0, a: t.assistant.fallback };
  for (const item of t.faq.items) {
    const score = [...words(item.q + ' ' + item.a)].filter((w) => q.has(w)).length;
    if (score > best.score) best = { score, a: item.a };
  }
  return best.a;
}

/**
 * Floating AI assistant: a glowing orb in the corner opens a chat panel.
 * Any link to "#assistant" (header "Ask AI") also opens it.
 */
export function Ai_Assistant({ t, locale }: { t: Dictionary; locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // "#assistant" links open the panel; the hash is removed so the link works again next time
  useEffect(() => {
    const check = () => {
      if (window.location.hash === '#assistant') {
        setOpen(true);
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  // small teaser bubble after a few seconds, once per visit
  useEffect(() => {
    const show = setTimeout(() => setTeaser(true), 4000);
    const hide = setTimeout(() => setTeaser(false), 12000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, []);

  useEffect(() => { if (open) { setTeaser(false); setTimeout(() => input.current?.focus({ preventScroll: true }), 350); } }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // scroll only the chat box, never the page
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [turns, busy]);

  async function ask(question: string) {
    const q = question.trim().slice(0, 1000);
    if (!q || busy) return;
    const history: Turn[] = [...turns, { role: 'user', content: q }];
    setTurns(history);
    setText('');
    setBusy(true);
    try {
      const response = await fetch(`${API}/public/assistant`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, messages: history.slice(-11).map(({ role, content }) => ({ role, content })) }),
      });
      if (response.status === 429) { setTurns([...history, { role: 'assistant', content: t.assistant.busy, local: true }]); return; }
      if (response.status === 503) { // not configured / down: answer quietly from the built-in FAQ
        setOffline(true);
        setTurns([...history, { role: 'assistant', content: localAnswer(t, q), local: true }]);
        return;
      }
      if (!response.ok) throw new Error('offline');
      const { reply } = (await response.json()) as { reply: string };
      setOffline(false);
      setTurns([...history, { role: 'assistant', content: reply }]);
    } catch {
      setOffline(true);
      setTurns([...history, { role: 'assistant', content: `${t.assistant.error}\n${localAnswer(t, q)}`, local: true }]);
    } finally {
      setBusy(false);
    }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); void ask(text); };

  return (
    <div className="fixed bottom-5 end-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:end-7">
      {/* ---------------------------------------------------------------- panel */}
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label={t.assistant.name}
            initial={{ opacity: 0, scale: 0.6, y: 40, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.7, y: 30, filter: 'blur(6px)' }} transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            style={{ transformOrigin: t.dir === 'rtl' ? 'bottom left' : 'bottom right' }}
            className="fixed inset-x-3 bottom-3 top-16 flex flex-col overflow-hidden rounded-[30px] bg-white shadow-[0_40px_100px_-30px_rgba(11,37,69,0.55)] ring-1 ring-navy/10 sm:static sm:h-[600px] sm:w-[400px]">
            {/* header: navy with drifting glow */}
            <div className="relative overflow-hidden bg-navy px-5 pb-6 pt-5 text-white">
              <motion.div className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-teal/50 blur-3xl"
                animate={{ x: [0, -30, 0], y: [0, 20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
              <motion.div className="pointer-events-none absolute -bottom-24 start-0 h-48 w-48 rounded-full bg-amber/25 blur-3xl"
                animate={{ x: [0, 40, 0] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }} />
              <div className="relative flex items-center gap-3">
                <Orb size={44} />
                <div className="flex-1">
                  <div className="font-display text-[17px] font-bold">{t.assistant.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-white/65">
                    <span className={`h-1.5 w-1.5 rounded-full ${offline ? 'bg-amber' : 'animate-pulse bg-glow'}`} />{offline ? t.assistant.offline : t.assistant.status}
                  </div>
                </div>
                {turns.length > 0 && (
                  <button type="button" onClick={() => { setTurns([]); setOffline(false); }} aria-label={t.assistant.clear} title={t.assistant.clear}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"><RotateCcw size={16} /></button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"><X size={18} /></button>
              </div>
            </div>

            {/* messages (overlaps header with a rounded sheet) */}
            <div ref={scroller} className="relative -mt-3 flex-1 space-y-3 overflow-y-auto rounded-t-[24px] bg-paper px-4 pb-4 pt-5" aria-live="polite">
              <Bubble role="assistant">{t.assistant.hello}</Bubble>
              {turns.length === 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {t.assistant.suggestions.map((s, i) => (
                    <motion.button key={s} type="button" onClick={() => ask(s)} disabled={busy}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.06, ease }} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
                      className="rounded-full border border-teal/25 bg-white px-3.5 py-2 text-[13px] font-medium text-teal transition-colors hover:border-teal/60 hover:bg-teal/5">
                      {s}
                    </motion.button>
                  ))}
                </div>
              )}
              {turns.map((turn, i) => <Bubble key={i} role={turn.role} local={turn.local}>{turn.content}</Bubble>)}
              <AnimatePresence>
                {busy && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex w-fit gap-1.5 rounded-2xl rounded-es-md bg-white px-4 py-3.5 shadow-sm">
                    {[0, 1, 2].map((d) => (
                      <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-teal" animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-line/70 bg-white px-3 pb-3 pt-3">
              <form onSubmit={submit} className="flex items-center gap-2 rounded-full bg-paper p-1.5 ps-4 ring-1 ring-transparent transition-shadow focus-within:ring-teal/35">
                <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={t.assistant.placeholder} aria-label={t.assistant.placeholder}
                  className="min-h-10 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-mist/70" />
                <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={!text.trim() || busy} aria-label={t.assistant.send}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white transition-opacity disabled:opacity-25">
                  <ArrowUp size={18} />
                </motion.button>
              </form>
              <p className="px-2 pt-2 text-center text-[10.5px] text-mist/75">{t.assistant.disclaimer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------------------- teaser + launcher */}
      <div className="flex items-center gap-3">
        <AnimatePresence>
          {teaser && !open && (
            <motion.button type="button" onClick={() => setOpen(true)}
              initial={{ opacity: 0, x: 20, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 12, scale: 0.9 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="hidden max-w-[230px] rounded-2xl rounded-ee-md bg-white px-4 py-3 text-start text-sm font-medium text-navy shadow-[0_20px_40px_-15px_rgba(11,37,69,0.35)] ring-1 ring-navy/5 sm:block">
              {t.assistant.eyebrow} ✦ <span className="text-mist">{t.assistant.suggestions[0]}</span>
            </motion.button>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {!open && (
            <motion.button type="button" onClick={() => setOpen(true)} aria-label={t.nav.faq}
              initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ type: 'spring', stiffness: 320, damping: 18 }}
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} className="relative rounded-full">
              <motion.span className="absolute inset-0 rounded-full bg-teal/40" animate={{ scale: [1, 1.6], opacity: [0.5, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }} />
              <Orb size={64} spinning />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Navy orb with a rotating teal/amber light ring and a sparkle mark. */
function Orb({ size, spinning = false }: { size: number; spinning?: boolean }) {
  return (
    <span className="relative flex items-center justify-center overflow-hidden rounded-full shadow-[0_16px_36px_-10px_rgba(11,37,69,0.7)]" style={{ width: size, height: size }}>
      <motion.span className="absolute -inset-1 bg-[conic-gradient(from_0deg,#7FD3CF,#0E8A86,#F2B544,#7FD3CF)]"
        animate={spinning ? { rotate: 360 } : undefined} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} />
      <span className="absolute inset-[2px] rounded-full bg-gradient-to-br from-[#123A66] to-navy" />
      <span className="absolute inset-[2px] rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(127,211,207,0.35),transparent_60%)]" />
      <motion.span className="relative text-amber" animate={{ rotate: [0, 12, -8, 0], scale: [1, 1.08, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
        <Sparkles size={Math.round(size * 0.42)} strokeWidth={1.6} />
      </motion.span>
    </span>
  );
}

function Bubble({ role, local, children }: { role: Turn['role']; local?: boolean; children: string }) {
  const mine = role === 'user';
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3, ease }}
      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <p dir="auto" className={`max-w-[85%] whitespace-pre-line px-4 py-3 text-[14.5px] leading-relaxed ${mine
        ? 'rounded-2xl rounded-ee-md bg-navy text-white'
        : `rounded-2xl rounded-es-md bg-white text-ink shadow-sm ${local ? 'ring-1 ring-amber/40' : ''}`}`}>
        {children}
      </p>
    </motion.div>
  );
}
