'use client';
import { animate, useInView, useMotionValue, useReducedMotion, useTransform, motion } from 'motion/react';
import { useEffect, useRef } from 'react';

/** Counts up from 0 when it scrolls into view (instant when the user prefers reduced motion). */
export function Animated_Number({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString('en-US'));

  useEffect(() => {
    if (!inView) return;
    if (reduce) { mv.set(value); return; }
    const controls = animate(mv, value, { duration: 1.1, ease: [0.2, 0, 0, 1] });
    return () => controls.stop();
  }, [inView, value, reduce, mv]);

  return <motion.span ref={ref} className={className}>{text}</motion.span>;
}
