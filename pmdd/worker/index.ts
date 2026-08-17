import { Hono } from 'hono';
import {
  cycleInfo,
  dosesFor,
  supplyStatus,
  todayIn,
  type Item,
  type Settings,
  type SupplyStatus,
} from '../shared/protocol';
import { buildFeed } from './ics';

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  TIMEZONE: string;
  ACCESS_KEY?: string;
}

const ITEMS: Item[] = ['aeon', 'glutathione', 'carnosine', 'sp6', 'elix', 'elix_extra', 'd3k2'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const app = new Hono<{ Bindings: Env }>();

// ---- auth: single shared-link key, sent as a header (SPA) or ?k= (feed).
// The SPA stores the key from the share link in localStorage client-side —
// static assets are served before the worker, so a cookie flow can't work.
// Fails closed when the secret is unset. ----

app.use('/api/*', async (c, next) => {
  if (!c.env.ACCESS_KEY) return c.json({ error: 'not_configured' }, 503);
  const presented = c.req.header('x-access-key') ?? c.req.query('k');
  if (presented !== c.env.ACCESS_KEY) return c.json({ error: 'unauthorized' }, 401);
  await next();
});

// ---- data helpers ----

async function loadSettings(db: D1Database): Promise<Settings> {
  const row = await db
    .prepare('SELECT cycle_len, luteal_start FROM settings WHERE id = 1')
    .first<{ cycle_len: number; luteal_start: number }>();
  return { cycleLen: row?.cycle_len ?? 28, lutealStart: row?.luteal_start ?? 15 };
}

async function loadStarts(db: D1Database): Promise<string[]> {
  const { results } = await db
    .prepare('SELECT start_date FROM cycles ORDER BY start_date')
    .all<{ start_date: string }>();
  return results.map((r) => r.start_date);
}

async function loadSupplies(
  db: D1Database,
  today: string,
  settings: Settings,
): Promise<SupplyStatus[]> {
  const { results } = await db
    .prepare(
      `SELECT s.item, s.qty_start, s.opened_date,
              (SELECT COUNT(*) FROM dose_log d
                WHERE d.item = s.item AND d.done = 1 AND d.date >= s.opened_date) AS used
         FROM supplies s`,
    )
    .all<{ item: Item; qty_start: number; opened_date: string; used: number }>();
  return results
    .filter((r) => ITEMS.includes(r.item))
    .map((r) =>
      supplyStatus(r.item, r.qty_start, r.used, today, settings.cycleLen, settings.lutealStart),
    );
}

// ---- API ----

app.get('/api/state', async (c) => {
  const db = c.env.DB;
  const today = todayIn(c.env.TIMEZONE);
  const date = DATE_RE.test(c.req.query('date') ?? '') ? c.req.query('date')! : today;
  const [settings, starts] = await Promise.all([loadSettings(db), loadStarts(db)]);
  const info = cycleInfo(date, starts, settings);
  const doses = info ? dosesFor(date, info.phase) : [];
  const { results: doneRows } = await db
    .prepare('SELECT item FROM dose_log WHERE date = ? AND done = 1')
    .bind(date)
    .all<{ item: string }>();
  const done = new Set(doneRows.map((r) => r.item));
  const checkin = await db.prepare('SELECT * FROM checkins WHERE date = ?').bind(date).first();
  const supplies = await loadSupplies(db, today, settings);
  return c.json({
    today,
    date,
    cycle: info,
    doses: doses.map((d) => ({ ...d, done: done.has(d.item) })),
    checkin,
    supplies,
    cycleStarts: starts,
  });
});

app.post('/api/dose', async (c) => {
  const body = await c.req.json<{ date?: string; item?: string; done?: boolean }>();
  if (!DATE_RE.test(body.date ?? '') || !ITEMS.includes(body.item as Item))
    return c.json({ error: 'bad_request' }, 400);
  await c.env.DB.prepare(
    `INSERT INTO dose_log (date, item, done) VALUES (?, ?, ?)
     ON CONFLICT (date, item) DO UPDATE SET done = excluded.done, updated_at = datetime('now')`,
  )
    .bind(body.date, body.item, body.done ? 1 : 0)
    .run();
  return c.json({ ok: true });
});

app.post('/api/checkin', async (c) => {
  const b = await c.req.json<Record<string, unknown>>();
  const date = typeof b.date === 'string' && DATE_RE.test(b.date) ? b.date : null;
  if (!date) return c.json({ error: 'bad_request' }, 400);
  const score = (v: unknown): number | null =>
    typeof v === 'number' && v >= 1 && v <= 5 ? Math.round(v) : null;
  const text = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 2000) : '');
  await c.env.DB.prepare(
    `INSERT INTO checkins (date, mood, energy, sleep, cravings, pain, diet, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (date) DO UPDATE SET
       mood = excluded.mood, energy = excluded.energy, sleep = excluded.sleep,
       cravings = excluded.cravings, pain = excluded.pain,
       diet = excluded.diet, notes = excluded.notes, updated_at = datetime('now')`,
  )
    .bind(
      date,
      score(b.mood),
      score(b.energy),
      score(b.sleep),
      score(b.cravings),
      score(b.pain),
      text(b.diet),
      text(b.notes),
    )
    .run();
  return c.json({ ok: true });
});

app.post('/api/period', async (c) => {
  const body = await c.req.json<{ date?: string }>();
  if (!DATE_RE.test(body.date ?? '')) return c.json({ error: 'bad_request' }, 400);
  await c.env.DB.prepare('INSERT OR IGNORE INTO cycles (start_date) VALUES (?)')
    .bind(body.date)
    .run();
  return c.json({ ok: true });
});

app.delete('/api/period/:date', async (c) => {
  const date = c.req.param('date');
  if (!DATE_RE.test(date)) return c.json({ error: 'bad_request' }, 400);
  await c.env.DB.prepare('DELETE FROM cycles WHERE start_date = ?').bind(date).run();
  return c.json({ ok: true });
});

app.post('/api/supply', async (c) => {
  const body = await c.req.json<{ item?: string; qty?: number; opened?: string }>();
  if (
    !ITEMS.includes(body.item as Item) ||
    typeof body.qty !== 'number' ||
    body.qty < 1 ||
    body.qty > 500 ||
    !DATE_RE.test(body.opened ?? '')
  )
    return c.json({ error: 'bad_request' }, 400);
  await c.env.DB.prepare(
    `INSERT INTO supplies (item, qty_start, opened_date) VALUES (?, ?, ?)
     ON CONFLICT (item) DO UPDATE SET qty_start = excluded.qty_start, opened_date = excluded.opened_date`,
  )
    .bind(body.item, Math.round(body.qty), body.opened)
    .run();
  return c.json({ ok: true });
});

app.get('/api/trends', async (c) => {
  const db = c.env.DB;
  const today = todayIn(c.env.TIMEZONE);
  const [settings, starts] = await Promise.all([loadSettings(db), loadStarts(db)]);
  const { results } = await db
    .prepare('SELECT * FROM checkins ORDER BY date DESC LIMIT 120')
    .all<Record<string, unknown> & { date: string }>();
  const { results: doseRows } = await db
    .prepare('SELECT date, COUNT(*) AS n FROM dose_log WHERE done = 1 GROUP BY date')
    .all<{ date: string; n: number }>();
  const doneByDate = new Map(doseRows.map((r) => [r.date, r.n]));
  const rows = results
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => {
      const info = cycleInfo(r.date, starts, settings);
      const required = info ? dosesFor(r.date, info.phase).filter((d) => !d.optional).length : 0;
      return {
        ...r,
        cycleDay: info?.day ?? null,
        phase: info?.phase ?? null,
        protocolRequired: required,
        protocolDone: Math.min(doneByDate.get(r.date) ?? 0, required),
      };
    });
  return c.json({ today, rows });
});

// ---- iCal feed (key in query — calendar clients can't send cookies) ----

app.get('/calendar.ics', async (c) => {
  if (!c.env.ACCESS_KEY || c.req.query('k') !== c.env.ACCESS_KEY)
    return c.text('unauthorized', 401);
  const db = c.env.DB;
  const today = todayIn(c.env.TIMEZONE);
  const [settings, starts] = await Promise.all([loadSettings(db), loadStarts(db)]);
  const supplies = await loadSupplies(db, today, settings);
  return c.body(buildFeed(today, starts, settings, supplies), 200, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
});

export default app;
