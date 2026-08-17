// Protocol engine: one source of truth for cycle math, the daily regimen, and
// supply burn rates. The worker computes from this for both the JSON API and
// the iCal feed, so the app and the subscribed calendar can never disagree.

export type Item =
  | 'aeon'
  | 'glutathione'
  | 'carnosine'
  | 'sp6'
  | 'elix'
  | 'elix_extra'
  | 'd3k2';

export type Phase = 'follicular' | 'luteal';

export interface Settings {
  cycleLen: number; // fallback when history can't estimate
  lutealStart: number; // cycle day the luteal block begins (1-based)
}

export interface Dose {
  item: Item;
  label: string;
  detail: string;
  optional?: boolean;
}

export const ITEM_LABELS: Record<Item, string> = {
  aeon: 'Y-Age Aeon',
  glutathione: 'Y-Age Glutathione',
  carnosine: 'Y-Age Carnosine',
  sp6: 'SP6 Complete',
  elix: 'Elix Cycle Balance',
  elix_extra: 'Elix extra dose',
  d3k2: 'Vitamin D3 + K2',
};

// Weekly placement rotation (0 = Sunday … 6 = Saturday). Aeon daily; the
// second patch is Carnosine on Wed/Sat, Glutathione otherwise. The lower leg
// is deliberately excluded — it belongs to SP6 during the luteal phase.
const ROTATION: Record<
  number,
  { aeonSite: string; second: Item; secondSite: string }
> = {
  0: { aeonSite: 'mid-chest', second: 'glutathione', secondSite: 'back of right wrist' },
  1: { aeonSite: 'throat notch', second: 'glutathione', secondSite: 'navel' },
  2: { aeonSite: 'base of neck (back)', second: 'glutathione', secondSite: 'mid-lower back' },
  3: { aeonSite: 'mid-chest', second: 'carnosine', secondSite: 'right inner wrist' },
  4: { aeonSite: 'navel', second: 'glutathione', secondSite: 'mid-lower back' },
  5: { aeonSite: 'throat notch', second: 'glutathione', secondSite: 'back of right wrist' },
  6: { aeonSite: 'base of neck (back)', second: 'carnosine', secondSite: 'right inner wrist' },
};

const D3_DAYS = new Set([1, 3, 5]); // Mon / Wed / Fri

// ---- date helpers (all dates are YYYY-MM-DD strings in the client's zone) ----

export function toUTC(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

export function addDays(date: string, n: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(date: string): number {
  return toUTC(date).getUTCDay();
}

export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

// ---- cycle math ----

/** Median of the gaps between recent period starts, else the settings default. */
export function estimateCycleLen(starts: string[], fallback: number): number {
  const sorted = [...starts].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const g = daysBetween(sorted[i - 1], sorted[i]);
    if (g >= 21 && g <= 45) gaps.push(g);
  }
  if (gaps.length === 0) return fallback;
  const recent = gaps.slice(-4).sort((a, b) => a - b);
  return recent[Math.floor(recent.length / 2)];
}

export interface CycleInfo {
  anchor: string; // most recent period start on/before the date
  day: number; // 1-based cycle day
  phase: Phase;
  cycleLen: number;
  lutealStartDate: string;
  nextPeriodDate: string; // predicted
}

export function cycleInfo(
  date: string,
  starts: string[],
  settings: Settings,
): CycleInfo | null {
  const anchor = [...starts].sort().filter((s) => s <= date).pop();
  if (!anchor) return null;
  const day = daysBetween(anchor, date) + 1;
  const cycleLen = estimateCycleLen(starts, settings.cycleLen);
  // Once the luteal block starts it holds until the next period is actually
  // logged — an overdue cycle stays luteal rather than flipping on a guess.
  const phase: Phase = day >= settings.lutealStart ? 'luteal' : 'follicular';
  return {
    anchor,
    day,
    phase,
    cycleLen,
    lutealStartDate: addDays(anchor, settings.lutealStart - 1),
    nextPeriodDate: addDays(anchor, cycleLen),
  };
}

// ---- the day's regimen ----

export function dosesFor(date: string, phase: Phase): Dose[] {
  const rot = ROTATION[weekday(date)];
  const doses: Dose[] = [
    { item: 'aeon', label: ITEM_LABELS.aeon, detail: `Patch on ${rot.aeonSite}` },
    {
      item: rot.second,
      label: ITEM_LABELS[rot.second],
      detail: `Patch on ${rot.secondSite}`,
    },
  ];
  if (phase === 'luteal')
    doses.push({
      item: 'sp6',
      label: ITEM_LABELS.sp6,
      detail: 'Patch above the right inner ankle',
    });
  doses.push({
    item: 'elix',
    label: ITEM_LABELS.elix,
    detail: '6 dropperfuls (1 tsp)',
  });
  if (phase === 'luteal')
    doses.push({
      item: 'elix_extra',
      label: ITEM_LABELS.elix_extra,
      detail: 'Optional on high-symptom days',
      optional: true,
    });
  if (D3_DAYS.has(weekday(date)))
    doses.push({ item: 'd3k2', label: ITEM_LABELS.d3k2, detail: '2 mL, food optional' });
  return doses;
}

// ---- supplies ----

/** Average doses consumed per day, for runout projection. */
export function dailyRate(item: Item, cycleLen: number, lutealStart: number): number {
  const lutealDays = Math.max(cycleLen - lutealStart + 1, 0);
  switch (item) {
    case 'aeon':
      return 1;
    case 'glutathione':
      return 5 / 7;
    case 'carnosine':
      return 2 / 7;
    case 'sp6':
      return lutealDays / cycleLen;
    case 'elix':
      return 1; // one bottle ≈ 15 days at 1 tsp/day
    case 'd3k2':
      return 3 / 7;
    case 'elix_extra':
      return 0;
  }
}

export const REORDER_LEAD_DAYS = 10;

export interface SupplyStatus {
  item: Item;
  label: string;
  remaining: number;
  daysLeft: number;
  runoutDate: string;
  reorderDate: string;
  status: 'ok' | 'reorder' | 'critical';
}

export function supplyStatus(
  item: Item,
  qtyStart: number,
  used: number,
  today: string,
  cycleLen: number,
  lutealStart: number,
): SupplyStatus {
  const remaining = Math.max(qtyStart - used, 0);
  const rate = dailyRate(item, cycleLen, lutealStart);
  const daysLeft = rate > 0 ? Math.floor(remaining / rate) : 9999;
  const runoutDate = addDays(today, daysLeft);
  const reorderDate = addDays(runoutDate, -REORDER_LEAD_DAYS);
  const status =
    daysLeft <= REORDER_LEAD_DAYS / 2
      ? 'critical'
      : daysLeft <= REORDER_LEAD_DAYS
        ? 'reorder'
        : 'ok';
  return {
    item,
    label: ITEM_LABELS[item],
    remaining,
    daysLeft,
    runoutDate,
    reorderDate,
    status,
  };
}
