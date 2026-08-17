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
  AI?: Ai; // optional — journal story degrades gracefully without it
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
  const { results: avoid } = await db
    .prepare('SELECT id, label, note FROM avoid_items ORDER BY created_at DESC')
    .all<{ id: number; label: string; note: string }>();
  return c.json({
    today,
    date,
    cycle: info,
    doses: doses.map((d) => ({ ...d, done: done.has(d.item) })),
    checkin,
    supplies,
    cycleStarts: starts,
    avoid,
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

// ---- journal + story ----

app.get('/api/journal', async (c) => {
  const db = c.env.DB;
  const { results: entries } = await db
    .prepare('SELECT id, date, text, created_at FROM journal ORDER BY date DESC, id DESC LIMIT 100')
    .all<{ id: number; date: string; text: string; created_at: string }>();
  const story = await db
    .prepare('SELECT text, entry_count, updated_at FROM story WHERE id = 1')
    .first<{ text: string; entry_count: number; updated_at: string }>();
  return c.json({ entries, story: story ?? null, aiAvailable: Boolean(c.env.AI) });
});

app.post('/api/journal', async (c) => {
  const b = await c.req.json<{ date?: string; text?: string }>();
  const text = typeof b.text === 'string' ? b.text.trim().slice(0, 4000) : '';
  if (!DATE_RE.test(b.date ?? '') || !text) return c.json({ error: 'bad_request' }, 400);
  await c.env.DB.prepare('INSERT INTO journal (date, text) VALUES (?, ?)').bind(b.date, text).run();
  return c.json({ ok: true });
});

app.delete('/api/journal/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'bad_request' }, 400);
  await c.env.DB.prepare('DELETE FROM journal WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

const STORY_MODEL = '@cf/meta/llama-3.1-8b-instruct';

app.post('/api/journal/story', async (c) => {
  if (!c.env.AI) return c.json({ error: 'ai_not_available' }, 503);
  const db = c.env.DB;
  const [settings, starts] = await Promise.all([loadSettings(db), loadStarts(db)]);
  const { results: entries } = await db
    .prepare('SELECT date, text FROM journal ORDER BY date ASC, id ASC')
    .all<{ date: string; text: string }>();
  if (entries.length === 0) return c.json({ error: 'no_entries' }, 400);

  const recent = entries.slice(-40);
  const lines = recent.map((e) => {
    const info = cycleInfo(e.date, starts, settings);
    const ctx = info ? `cycle day ${info.day}, ${info.phase}` : 'cycle unknown';
    return `[${e.date} · ${ctx}] ${e.text.slice(0, 500)}`;
  });

  try {
    const result = (await c.env.AI.run(STORY_MODEL as Parameters<Ai['run']>[0], {
      messages: [
        {
          role: 'system',
          content:
            'You are the narrator inside GLORY, a private wellness journal for one woman managing PMDD. ' +
            'From her dated entries, write "the story so far": 3–5 short warm paragraphs in second person ("you"). ' +
            'Ground it in what she actually wrote; weave in where she was in her cycle when patterns matter. ' +
            'Name real progress and honestly acknowledge hard stretches without dwelling. Never shame gaps in the record, ' +
            'never give medical advice or mention medications/diagnoses beyond her own words, never invent events. ' +
            'End with one sentence that looks forward. No headings, no lists, no preamble — just the story.',
        },
        { role: 'user', content: lines.join('\n') },
      ],
      max_tokens: 700,
    })) as { response?: string };
    const text = (result.response ?? '').trim();
    if (!text) return c.json({ error: 'empty_response' }, 502);
    await db
      .prepare(
        `INSERT INTO story (id, text, entry_count, updated_at) VALUES (1, ?, ?, datetime('now'))
         ON CONFLICT (id) DO UPDATE SET text = excluded.text, entry_count = excluded.entry_count, updated_at = datetime('now')`,
      )
      .bind(text, entries.length)
      .run();
    return c.json({ story: { text, entry_count: entries.length } });
  } catch {
    return c.json({ error: 'ai_failed' }, 502);
  }
});

// ---- avoid list (deliberately avoid-only: no "good foods" scorekeeping) ----

app.post('/api/avoid', async (c) => {
  const b = await c.req.json<{ label?: string; note?: string }>();
  const label = typeof b.label === 'string' ? b.label.trim().slice(0, 80) : '';
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 200) : '';
  if (!label) return c.json({ error: 'bad_request' }, 400);
  await c.env.DB.prepare('INSERT INTO avoid_items (label, note) VALUES (?, ?)').bind(label, note).run();
  return c.json({ ok: true });
});

app.delete('/api/avoid/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'bad_request' }, 400);
  await c.env.DB.prepare('DELETE FROM avoid_items WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
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
