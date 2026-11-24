'use client';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

export interface Select_Option { value: string; label: string; hint?: string }

const THEMES = {
  light: {
    button: 'bg-white border-[#c3ced9] text-ink hover:border-navy/40 focus-visible:border-navy',
    open: 'border-navy shadow-[0_0_0_3px_rgba(11,37,69,0.10)]',
    panel: 'bg-white/95 border-navy/10 shadow-[0_30px_60px_-25px_rgba(11,37,69,0.45)]',
    option: 'text-ink', hint: 'text-mist', highlight: 'bg-navy/[0.06]', check: 'text-teal', search: 'border-navy/10 text-ink placeholder:text-mist',
  },
  dark: {
    button: 'bg-[rgba(5,15,29,0.6)] border-[#1c3d63] text-white hover:border-[#7fd3cf]/50 focus-visible:border-[#7fd3cf]',
    open: 'border-[#7fd3cf] shadow-[0_0_0_3px_rgba(127,211,207,0.15)]',
    panel: 'bg-[#0b2545]/95 border-white/10 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]',
    option: 'text-[#c9d6e5]', hint: 'text-[#a9bcd3]/70', highlight: 'bg-[#7fd3cf]/10', check: 'text-[#7fd3cf]', search: 'border-white/10 text-white placeholder:text-[#6f86a3]',
  },
} as const;

/**
 * Accessible custom dropdown (ARIA listbox): click or Enter/Space opens, arrows move, Enter selects,
 * Escape closes, typing filters long lists. Smooth spring panel, staggered options, gliding highlight.
 */
export function Fancy_Select({ value, onChange, options, placeholder = 'Select…', label, theme = 'light', searchable }: {
  value: string; onChange: (value: string) => void; options: Select_Option[]; placeholder?: string; label?: string;
  theme?: keyof typeof THEMES; searchable?: boolean;
}) {
  const t = THEMES[theme];
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = searchable ?? options.length > 8;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (open) { setQuery(''); setActive(Math.max(0, options.findIndex((o) => o.value === value))); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (option: Select_Option) => { onChange(option.value); setOpen(false); button.current?.focus(); };

  const onKey = (e: KeyboardEvent) => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); button.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(visible.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (visible[active]) pick(visible[active]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      <button ref={button} type="button" id={`${id}-button`} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`} aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[14px] border-[1.5px] px-4 text-start outline-none transition-all duration-200 ${t.button} ${open ? t.open : ''}`}>
        <span className={`truncate ${selected ? '' : 'opacity-50'}`}>{selected?.label ?? placeholder}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 26 }} className="shrink-0 opacity-60">
          <ChevronDown size={18} strokeWidth={1.6} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -4, scale: 0.98, filter: 'blur(2px)' }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{ transformOrigin: 'top center' }}
            className={`absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border backdrop-blur-xl ${t.panel}`}>
            {search && (
              <div className={`flex items-center gap-2 border-b px-3 ${t.search}`}>
                <Search size={15} strokeWidth={1.6} className="opacity-50" />
                <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} placeholder="Type to search…"
                  className="h-11 w-full bg-transparent text-sm outline-none" aria-label="Search options" />
              </div>
            )}
            <motion.ul id={`${id}-list`} role="listbox" aria-labelledby={`${id}-button`} className="max-h-64 overflow-y-auto p-1.5"
              initial="h" animate="s" variants={{ h: {}, s: { transition: { staggerChildren: 0.025 } } }}>
              {visible.length === 0 && <li className={`px-3 py-3 text-sm ${t.hint}`}>No match</li>}
              {visible.map((option, i) => {
                const isSelected = option.value === value;
                return (
                  <motion.li key={option.value} role="option" aria-selected={isSelected}
                    variants={{ h: { opacity: 0, y: -4 }, s: { opacity: 1, y: 0 } }}
                    onMouseEnter={() => setActive(i)} onClick={() => pick(option)}
                    className={`relative flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 text-sm ${t.option}`}>
                    {active === i && <motion.span layoutId={`${id}-hl`} className={`absolute inset-0 rounded-xl ${t.highlight}`} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <span className="relative min-w-0">
                      <span className={`block truncate ${isSelected ? 'font-semibold' : ''}`}>{option.label}</span>
                      {option.hint && <span className={`block truncate text-xs ${t.hint}`}>{option.hint}</span>}
                    </span>
                    <AnimatePresence>
                      {isSelected && (
                        <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} className={`relative ${t.check}`}>
                          <Check size={16} strokeWidth={2} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
