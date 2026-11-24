'use client';
import { motion, useReducedMotion } from 'motion/react';

/** Stations (nodes) light up one by one and send pulses to the company hub: "many stations, one platform, isolated". */
const HUB = { x: 400, y: 300 };
const NODES = [
  { x: 120, y: 120 }, { x: 260, y: 70 }, { x: 560, y: 90 }, { x: 690, y: 170 }, { x: 720, y: 360 },
  { x: 610, y: 500 }, { x: 420, y: 540 }, { x: 210, y: 500 }, { x: 90, y: 360 }, { x: 300, y: 240 }, { x: 520, y: 250 },
];

export function Login_Backdrop() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 800 600" className="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="hubGlow">
          <stop offset="0%" stopColor="#7FD3CF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7FD3CF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <motion.circle cx={HUB.x} cy={HUB.y} r={120} fill="url(#hubGlow)"
        animate={reduce ? undefined : { r: [110, 135, 110] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
      {NODES.map((n, i) => (
        <g key={i}>
          <motion.path d={`M${n.x} ${n.y} Q ${(n.x + HUB.x) / 2 + (i % 2 ? 40 : -40)} ${(n.y + HUB.y) / 2} ${HUB.x} ${HUB.y}`}
            fill="none" stroke="#1C3D63" strokeWidth={1.4}
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 + i * 0.12, ease: [0.2, 0, 0, 1] }} />
          {!reduce && (
            <motion.circle r={3} fill="#7FD3CF"
              initial={{ offsetDistance: '0%', opacity: 0 }}
              animate={{ offsetDistance: ['0%', '100%'], opacity: [0, 1, 0] }}
              style={{ offsetPath: `path("M${n.x} ${n.y} Q ${(n.x + HUB.x) / 2 + (i % 2 ? 40 : -40)} ${(n.y + HUB.y) / 2} ${HUB.x} ${HUB.y}")` }}
              transition={{ duration: 2.6, delay: 1.5 + i * 0.35, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }} />
          )}
          <motion.g initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.3 + i * 0.12 }} style={{ originX: `${n.x}px`, originY: `${n.y}px` }}>
            <rect x={n.x - 14} y={n.y - 10} width={28} height={20} rx={6} fill="#0F2C4F" stroke="#7FD3CF" strokeOpacity={0.5} />
            <rect x={n.x - 8} y={n.y - 3} width={16} height={6} rx={2} fill={i % 3 === 0 ? '#F2B544' : '#7FD3CF'} opacity={0.85} />
          </motion.g>
        </g>
      ))}
      <motion.g initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.1 }}
        style={{ originX: `${HUB.x}px`, originY: `${HUB.y}px` }}>
        <circle cx={HUB.x} cy={HUB.y} r={30} fill="#0B2545" stroke="#7FD3CF" strokeWidth={2} />
        <path d={`M${HUB.x} ${HUB.y - 14}a14 14 0 1 0 10 24 11 11 0 0 1 -10 -24z`} fill="#F2B544" />
      </motion.g>
    </svg>
  );
}
