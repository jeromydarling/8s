// Donut showing where today sits in the cycle. The two arcs are phases —
// directly labeled in the legend below, so color is never the only carrier.

import type { CycleInfo } from '../shared/protocol';

const SIZE = 180;
const R = 72;
const CX = SIZE / 2;
const CY = SIZE / 2;

function polar(angleDeg: number, r: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function arc(a0: number, a1: number, r: number): string {
  const [x0, y0] = polar(a0, r);
  const [x1, y1] = polar(a1, r);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function CycleRing({ cycle }: { cycle: CycleInfo }) {
  const len = cycle.cycleLen;
  // Follicular days in this cycle = days from anchor to luteal start (14 by default).
  const follDays = Math.round(
    (Date.parse(cycle.lutealStartDate + 'T00:00:00Z') - Date.parse(cycle.anchor + 'T00:00:00Z')) / 86_400_000,
  );
  const lutealA = (Math.min(Math.max(follDays, 1), len - 1) / len) * 360;
  const dayA = ((Math.min(cycle.day, len) - 0.5) / len) * 360;
  const [dx, dy] = polar(dayA, R);

  const GAP = 3; // degrees of breathing room between the two arcs

  return (
    <div className="ring-wrap">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`Cycle day ${cycle.day} of about ${len}. ${cycle.phase === 'luteal' ? 'Luteal' : 'Follicular'} phase.`}>
        <path d={arc(GAP, lutealA - GAP, R)} fill="none" stroke="var(--teal-soft)" strokeWidth={14} strokeLinecap="round" />
        <path d={arc(lutealA + GAP, 360 - GAP, R)} fill="none" stroke="var(--plum-soft)" strokeWidth={14} strokeLinecap="round" />
        <path
          className="ring-progress"
          d={arc(GAP, Math.max(dayA, GAP + 1), R)}
          fill="none"
          stroke={cycle.phase === 'luteal' ? 'var(--plum)' : 'var(--teal)'}
          strokeWidth={5}
          strokeLinecap="round"
          opacity={0.85}
        />
        <circle cx={dx} cy={dy} r={8} fill={cycle.phase === 'luteal' ? 'var(--plum)' : 'var(--teal)'} stroke="var(--surface)" strokeWidth={3} />
        <text x={CX} y={CY - 6} textAnchor="middle" fill="var(--ink)" fontSize={30} fontWeight={700}>
          {cycle.day}
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" fill="var(--muted)" fontSize={11.5} letterSpacing={1} style={{ textTransform: 'uppercase' }}>
          of ~{len} days
        </text>
      </svg>
      <div className="ring-legend">
        <span>
          <i className="swatch" style={{ background: 'var(--teal)' }} /> Follicular · days 1–14
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--plum)' }} /> Luteal · SP6 on
        </span>
      </div>
    </div>
  );
}
