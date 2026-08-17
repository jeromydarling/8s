// Small-multiple sparkline: one metric, one series (plum). Luteal days are a
// shaded band (form, not a second hue — the plum/teal pair fails CVD checks
// as same-chart series). Hover = dot highlight + tooltip; a table view below
// each group covers accessibility and print.

import { useRef, useState } from 'react';
import type { TrendRow } from './api';

const W = 520;
const H = 64;
const PAD = { top: 8, bottom: 8, left: 4, right: 30 };

export function Spark({ metric, label, rows }: { metric: keyof TrendRow; label: string; rows: TrendRow[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  const pts = rows
    .map((r, i) => ({ i, date: r.date, phase: r.phase, v: r[metric] as number | null }))
    .filter((p): p is { i: number; date: string; phase: string | null; v: number } => typeof p.v === 'number');

  if (pts.length === 0) return null;

  const n = rows.length;
  const x = (i: number) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + ((5 - v) / 4) * (H - PAD.top - PAD.bottom);
  const path = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');

  // contiguous luteal spans → shaded background bands
  const bands: { a: number; b: number }[] = [];
  rows.forEach((r, i) => {
    if (r.phase === 'luteal') {
      const last = bands[bands.length - 1];
      if (last && last.b === i - 1) last.b = i;
      else bands.push({ a: i, b: i });
    }
  });

  const latest = pts[pts.length - 1];

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = pts[0];
    for (const p of pts) if (Math.abs(x(p.i) - px) < Math.abs(x(best.i) - px)) best = p;
    setHover(best.i);
    setTip({
      x: rect.left + (x(best.i) / W) * rect.width,
      y: rect.top + (y(best.v) / H) * rect.height,
    });
  }

  const hovered = hover !== null ? pts.find((p) => p.i === hover) : undefined;

  return (
    <div className="spark-panel">
      <div className="spark-head">
        <span className="metric">{label}</span>
        <span className="latest">{latest.v}/5</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}, latest ${latest.v} of 5`}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHover(null);
          setTip(null);
        }}
      >
        {bands.map((b, k) => (
          <rect
            key={k}
            x={x(b.a) - (n > 1 ? (W - PAD.left - PAD.right) / (n - 1) / 2 : 0)}
            y={0}
            width={((b.b - b.a + 1) / Math.max(n - 1, 1)) * (W - PAD.left - PAD.right)}
            height={H}
            fill="var(--plum-soft)"
            opacity={0.55}
          />
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(3)} y2={y(3)} stroke="var(--line)" strokeWidth={1} />
        <path d={path} fill="none" stroke="var(--plum)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p) => (
          <circle
            key={p.i}
            cx={x(p.i)}
            cy={y(p.v)}
            r={hover === p.i ? 5 : 3}
            fill="var(--plum)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        ))}
      </svg>
      {hovered && tip && (
        <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
          {hovered.date} · {label} {hovered.v}/5{hovered.phase === 'luteal' ? ' · luteal' : ''}
        </div>
      )}
    </div>
  );
}
