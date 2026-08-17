import type { CycleInfo, Dose, Item, SupplyStatus } from '../shared/protocol';

export interface Checkin {
  date: string;
  mood: number | null;
  energy: number | null;
  sleep: number | null;
  cravings: number | null;
  pain: number | null;
  diet: string;
  notes: string;
}

export interface State {
  today: string;
  date: string;
  cycle: CycleInfo | null;
  doses: (Dose & { done: boolean })[];
  checkin: Checkin | null;
  supplies: SupplyStatus[];
  cycleStarts: string[];
}

export interface TrendRow extends Checkin {
  cycleDay: number | null;
  phase: string | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  state: (date?: string) => req<State>(`/api/state${date ? `?date=${date}` : ''}`),
  dose: (date: string, item: Item, done: boolean) =>
    req<{ ok: true }>('/api/dose', { method: 'POST', body: JSON.stringify({ date, item, done }) }),
  checkin: (data: Partial<Checkin> & { date: string }) =>
    req<{ ok: true }>('/api/checkin', { method: 'POST', body: JSON.stringify(data) }),
  period: (date: string) =>
    req<{ ok: true }>('/api/period', { method: 'POST', body: JSON.stringify({ date }) }),
  removePeriod: (date: string) => req<{ ok: true }>(`/api/period/${date}`, { method: 'DELETE' }),
  supply: (item: Item, qty: number, opened: string) =>
    req<{ ok: true }>('/api/supply', { method: 'POST', body: JSON.stringify({ item, qty, opened }) }),
  trends: () => req<{ today: string; rows: TrendRow[] }>('/api/trends'),
};
