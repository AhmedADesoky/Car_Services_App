'use client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Clock3, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';

const LETTERS = ['ق', 'ص', 'ر'];
const DIGITS = ['١', '٤', '٢', '٧'];
const NOISE = 'ابجدرسصطعفقلمنهوى٠١٢٣٤٥٦٧٨٩';

/** Phase 0: idle → 1: scanning (characters decode) → 2: recognised → 3: order card slides in. Loops. */
export function Plate_Scan_Visual({ labels }: { labels: { scanLabel: string; orderLabel: string; timer: string } }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(reduce ? 3 : 0);
  const [tick, setTick] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timeline = [800, 1800, 1100, 4300];
    let cancelled = false;
    let p = 0;
    const run = () => {
      if (cancelled) return;
      setPhase(p);
      const wait = timeline[p];
      p = (p + 1) % timeline.length;
      setTimeout(run, wait);
    };
    run();
    return () => { cancelled = true; };
  }, [reduce]);

  useEffect(() => {
    if (phase !== 1) return;
    const id = setInterval(() => setTick((t) => t + 1), 70);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 3) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const show = (real: string, i: number) => (phase >= 2 || (phase === 1 && tick > 6 + i * 3) ? real : phase === 1 ? NOISE[(tick * 7 + i * 13) % NOISE.length] : '·');

  return (
    <div className="relative mx-auto w-full max-w-[420px]" aria-hidden="true">
      {/* scanner frame */}
      <div className="relative rounded-[32px] border border-white/15 bg-white/[0.06] p-6 shadow-2xl backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between text-xs text-white/60">
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-glow" /> LIVE</span>
          <span className="font-mono">720p · 150 ms</span>
        </div>

        <div className="relative overflow-hidden rounded-2xl">
          {/* corner brackets */}
          {['left-2 top-2 border-l-2 border-t-2', 'right-2 top-2 border-r-2 border-t-2', 'left-2 bottom-2 border-l-2 border-b-2', 'right-2 bottom-2 border-r-2 border-b-2'].map((c) => (
            <motion.span key={c} className={`absolute z-10 h-6 w-6 rounded-sm border-glow ${c}`}
              animate={phase === 1 ? { opacity: [0.4, 1, 0.4] } : { opacity: phase >= 2 ? 1 : 0.5 }} transition={{ duration: 0.8, repeat: phase === 1 ? Infinity : 0 }} />
          ))}

          {/* the Egyptian plate */}
          <div className="relative mx-6 my-7 overflow-hidden rounded-xl border-[3px] border-ink bg-white" dir="ltr">
            <div className="flex items-center justify-between bg-[#8EC3EA] px-3 py-1 text-[11px] font-extrabold text-ink"><span>EGYPT</span><span>مصر</span></div>
            <div className="grid grid-cols-2 divide-x-[3px] divide-ink">
              <div className="flex justify-center gap-2 py-3 font-arabic text-3xl font-extrabold text-ink sm:text-4xl">
                {DIGITS.map((d, i) => <motion.span key={i} animate={{ y: phase === 1 ? [0, -2, 0] : 0 }} transition={{ duration: 0.2, repeat: phase === 1 ? Infinity : 0, delay: i * 0.05 }}>{show(d, i + 3)}</motion.span>)}
              </div>
              <div className="flex justify-center gap-2 py-3 font-arabic text-3xl font-extrabold text-ink sm:text-4xl" dir="rtl">
                {LETTERS.map((l, i) => <span key={i}>{show(l, i)}</span>)}
              </div>
            </div>
            {/* scan beam */}
            <AnimatePresence>
              {phase === 1 && (
                <motion.div className="absolute inset-y-0 w-1.5 bg-glow shadow-[0_0_24px_8px_rgba(127,211,207,0.7)]"
                  initial={{ left: '0%', opacity: 0 }} animate={{ left: ['0%', '98%', '0%'], opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 1.6, ease: 'easeInOut' }} />
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-4 h-12">
          <AnimatePresence mode="wait">
            {phase >= 2 && (
              <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-2xl bg-teal/20 px-4 py-3 text-sm font-semibold text-glow">
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-glow text-navy"><Check size={14} strokeWidth={3} /></motion.span>
                {labels.scanLabel} · <span className="font-mono">QCR1427</span> · 98%
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* order card */}
      <AnimatePresence>
        {phase === 3 && (
          <motion.div initial={{ opacity: 0, y: 40, rotate: -4, scale: 0.9 }} animate={{ opacity: 1, y: 0, rotate: -2, scale: 1 }} exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            className="absolute -bottom-32 -right-2 w-64 rounded-3xl bg-white p-4 text-ink shadow-2xl sm:-right-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal">{labels.orderLabel}</span>
              <span className="flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 font-mono text-xs font-bold"><Clock3 size={12} />00:{String(seconds).padStart(2, '0')}</span>
            </div>
            <div className="mt-2 font-display text-lg font-bold">Toyota Corolla · Silver</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-mist"><Wrench size={12} /> Oil change · Brake pads</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper">
              <motion.div className="h-full rounded-full bg-teal" initial={{ width: '4%' }} animate={{ width: '66%' }} transition={{ duration: 4, ease: 'easeOut' }} />
            </div>
            <div className="mt-2 text-[11px] text-mist">{labels.timer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
