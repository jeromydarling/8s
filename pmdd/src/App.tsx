import { useCallback, useEffect, useMemo, useState } from 'react';
import { accessKey, api, type State, type TrendRow } from './api';
import type { Item } from '../shared/protocol';
import { Spark } from './Spark';
import { CycleRing } from './CycleRing';
import {
  BanIcon,
  BookIcon,
  BoxIcon,
  ChartIcon,
  GloryMark,
  HeartIcon,
  ITEM_ICON,
  MoonIcon,
  SunIcon,
  ThemeGlyph,
} from './icons';
import { applyTheme, nextTheme, storedTheme, type ThemeMode } from './theme';
import type { JournalEntry, Story } from './api';

type Tab = 'home' | 'checkin' | 'journal' | 'insights' | 'cycle' | 'supplies';

const NAV: [Tab, string, ({ size }: { size?: number }) => React.ReactNode][] = [
  ['home', 'Today', SunIcon],
  ['checkin', 'Check-in', HeartIcon],
  ['journal', 'Journal', BookIcon],
  ['insights', 'Insights', ChartIcon],
  ['cycle', 'Cycle', MoonIcon],
  ['supplies', 'Supplies', BoxIcon],
];

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(storedTheme);

  const refresh = useCallback(() => {
    api
      .state()
      .then((s) => {
        setState(s);
        setError(null);
      })
      .catch((e: Error) =>
        setError(
          e.message === '401' || e.message === '503'
            ? 'This link is missing its access key. Open the app from the full link you were sent.'
            : 'Could not reach the server. Check your connection and try again.',
        ),
      );
  }, []);

  useEffect(refresh, [refresh]);

  function cycleTheme() {
    const next = nextTheme(theme);
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="shell">
      <div className="topbar">
        <span className="wordmark">
          <GloryMark />
          <span>GLORY</span>
        </span>
        <button
          className="theme-btn"
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}. Tap to change.`}
          title={`Theme: ${theme}`}
        >
          <ThemeGlyph mode={theme} />
        </button>
      </div>

      {error && <div className="card">{error}</div>}

      {state && tab === 'home' && <Home state={state} refresh={refresh} />}
      {state && tab === 'checkin' && <CheckIn state={state} refresh={refresh} />}
      {state && tab === 'journal' && <Journal today={state.today} />}
      {tab === 'insights' && <Insights />}
      {state && tab === 'cycle' && <Cycle state={state} refresh={refresh} />}
      {state && tab === 'supplies' && <Supplies state={state} refresh={refresh} />}

      <nav className="nav" aria-label="Sections">
        {NAV.map(([id, name, Icon]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            <Icon size={20} />
            {name}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ---- Home: greeting, cycle position, today's protocol ----

function partOfDay(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function prettyDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function Home({ state, refresh }: { state: State; refresh: () => void }) {
  const { cycle, doses, date } = state;

  async function toggle(item: Item, done: boolean) {
    await api.dose(date, item, done);
    refresh();
  }

  const patches = doses.filter((d) => d.item !== 'elix' && d.item !== 'elix_extra' && d.item !== 'd3k2');

  return (
    <>
      <header className="hero">
        <div className="hero-halo" aria-hidden="true" />
        <p className="hero-greeting">{partOfDay()} —</p>
        <h1 className="hero-title">Take your life back.</h1>
        <p className="hero-sub">{prettyDate(state.date)}</p>
      </header>

      {cycle && (
        <section className="card home-cycle">
          <CycleRing cycle={cycle} />
          <p className="home-phase">
            {cycle.phase === 'luteal' ? (
              <>
                <strong>Luteal phase.</strong> SP6 joins the morning patches — this is the stretch the whole
                protocol is built around. Period expected around {prettyDate(cycle.nextPeriodDate)}.
              </>
            ) : (
              <>
                <strong>Follicular phase.</strong> The lighter half — two patches and the drops. The luteal
                block begins {prettyDate(cycle.lutealStartDate)}.
              </>
            )}
          </p>
        </section>
      )}

      <section className="card">
        <h2>Today's protocol</h2>
        <p className="note">
          {patches.length} patches this morning{doses.some((d) => d.item === 'd3k2') ? ' · D3 day' : ''} — off
          again by evening.
        </p>
        {doses.map((d) => {
          const Icon = ITEM_ICON[d.item];
          const chip = d.item === 'sp6' ? 'plum' : d.item === 'elix' || d.item === 'elix_extra' || d.item === 'd3k2' ? 'neutral' : '';
          return (
            <label key={d.item} className={`dose ${d.done ? 'done' : ''} ${d.optional ? 'optional' : ''}`}>
              <input type="checkbox" checked={d.done} onChange={(e) => toggle(d.item, e.target.checked)} />
              <span className={`dose-chip ${chip}`}>
                <Icon size={20} />
              </span>
              <span>
                <span className="dose-label">{d.label}</span>
                <br />
                <span className="dose-detail">{d.detail}</span>
              </span>
            </label>
          );
        })}
        <p className="note">
          Check things off if you like the satisfaction — nothing bad happens if you don't. Patches go on
          clean, dry skin; keep water nearby all day.
        </p>
      </section>

      {state.avoid.length > 0 && (
        <section className="card">
          <h2>
            <BanIcon size={15} /> Steering clear of
          </h2>
          <div className="avoid-strip">
            {state.avoid.map((a) => (
              <span className="avoid-chip" key={a.id} title={a.note || undefined}>
                <BanIcon size={13} /> {a.label}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ---- Journal ----

function prettyShort(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Journal({ today }: { today: string }) {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [draft, setDraft] = useState('');
  const [telling, setTelling] = useState(false);
  const [storyErr, setStoryErr] = useState(false);

  const load = useCallback(() => {
    api
      .journal()
      .then((r) => {
        setEntries(r.entries);
        setStory(r.story);
        setAiAvailable(r.aiAvailable);
      })
      .catch(() => setEntries([]));
  }, []);
  useEffect(load, [load]);

  async function save() {
    const text = draft.trim();
    if (!text) return;
    await api.addJournal(today, text);
    setDraft('');
    load();
  }

  async function retell() {
    setTelling(true);
    setStoryErr(false);
    try {
      const r = await api.tellStory();
      setStory(r.story);
    } catch {
      setStoryErr(true);
    } finally {
      setTelling(false);
    }
  }

  const newSinceStory = entries && story ? entries.length - story.entry_count : 0;

  return (
    <>
      <section className="card story-card">
        <h2>
          <BookIcon size={15} /> The story so far
        </h2>
        {story ? (
          <>
            <div className="story-text">
              {story.text.split(/\n{1,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <p className="note">
              Told from {story.entry_count} {story.entry_count === 1 ? 'entry' : 'entries'}
              {newSinceStory > 0 ? ` · ${newSinceStory} new since` : ''}
            </p>
          </>
        ) : (
          <p className="note">
            Write a few entries and GLORY will weave them into an ongoing story — the arc of what's
            changing, in plain words, told back to you.
          </p>
        )}
        {aiAvailable ? (
          entries && entries.length > 0 && (
            <button className="primary" onClick={retell} disabled={telling}>
              {telling ? 'Writing…' : story ? 'Retell the story' : 'Tell the story'}
            </button>
          )
        ) : (
          <p className="note">Story-telling isn't available right now — your entries are safe and it'll pick them all up later.</p>
        )}
        {storyErr && <p className="note">Couldn't write the story just now — nothing lost, try again in a bit.</p>}
      </section>

      <section className="card">
        <h2>Today's page</h2>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Whatever today held — a line is plenty."
          aria-label="Journal entry"
        />
        <button className="primary" onClick={save} disabled={!draft.trim()}>
          Add to the story
        </button>
      </section>

      {entries && entries.length > 0 && (
        <section className="card">
          <h2>Entries</h2>
          {entries.map((e) => (
            <div className="journal-entry" key={e.id}>
              <div className="journal-head">
                <span className="journal-date">{prettyShort(e.date)}</span>
                <button className="ghost small" onClick={() => api.removeJournal(e.id).then(load)}>
                  Remove
                </button>
              </div>
              <p className="journal-text">{e.text}</p>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

// ---- Check-in ----

const METRICS: [string, string, string, string][] = [
  ['mood', 'Mood', 'Rough', 'Great'],
  ['energy', 'Energy', 'Drained', 'Full'],
  ['sleep', 'Sleep quality', 'Poor', 'Restful'],
  ['cravings', 'Cravings', 'Intense', 'None'],
  ['pain', 'Pain / cramps', 'Severe', 'None'],
];

function CheckIn({ state, refresh }: { state: State; refresh: () => void }) {
  const c = state.checkin;
  const [scores, setScores] = useState<Record<string, number>>({
    mood: c?.mood ?? 3,
    energy: c?.energy ?? 3,
    sleep: c?.sleep ?? 3,
    cravings: c?.cravings ?? 3,
    pain: c?.pain ?? 3,
  });
  const [diet, setDiet] = useState(c?.diet ?? '');
  const [notes, setNotes] = useState(c?.notes ?? '');
  const [saved, setSaved] = useState(false);

  async function save() {
    await api.checkin({ date: state.date, ...scores, diet, notes });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    refresh();
  }

  return (
    <>
    <section className="card">
      <h2>How are you feeling?</h2>
      <p className="note">Thirty seconds, whenever you feel like it. There's no streak here and nothing to break.</p>
      {METRICS.map(([key, label, lo, hi]) => (
        <div className="slider-row" key={key}>
          <label htmlFor={`m-${key}`}>
            {label} <output>{scores[key]}/5</output>
          </label>
          <input
            id={`m-${key}`}
            type="range"
            min={1}
            max={5}
            step={1}
            value={scores[key]}
            onChange={(e) => setScores({ ...scores, [key]: Number(e.target.value) })}
          />
          <span className="ends">
            <span>{lo}</span>
            <span>{hi}</span>
          </span>
        </div>
      ))}
      <div className="slider-row">
        <label htmlFor="diet">Food today (optional)</label>
        <textarea id="diet" value={diet} onChange={(e) => setDiet(e.target.value)} placeholder="What you ate, craved, or noticed…" />
      </div>
      <div className="slider-row">
        <label htmlFor="notes">Anything else (optional)</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Symptoms, stressors, wins…" />
      </div>
      <button className="primary" onClick={save}>
        Save
      </button>
      {saved && <span className="saved-flash">Saved ✓</span>}
    </section>
    <AvoidList state={state} refresh={refresh} />
    </>
  );
}

// ---- Avoid list (avoid-only by design — no "good foods" tracking) ----

function AvoidList({ state, refresh }: { state: State; refresh: () => void }) {
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  async function add() {
    if (!label.trim()) return;
    await api.addAvoid(label.trim(), note.trim());
    setLabel('');
    setNote('');
    refresh();
  }

  return (
    <section className="card">
      <h2>
        <BanIcon size={15} /> Steering clear of
      </h2>
      <p className="note">
        When a food or drink turns out to make things worse, park it here. This list is only about what
        to avoid — what's working doesn't need a scoreboard.
      </p>
      {state.avoid.map((a) => (
        <div className="avoid-row" key={a.id}>
          <span className="avoid-chip">
            <BanIcon size={13} /> {a.label}
          </span>
          {a.note && <span className="note">{a.note}</span>}
          <button className="ghost small" onClick={() => api.removeAvoid(a.id).then(refresh)}>
            Remove
          </button>
        </div>
      ))}
      <div className="avoid-form">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. red wine"
          aria-label="Food or drink to avoid"
          maxLength={80}
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="why (optional) — e.g. luteal headaches"
          aria-label="Reason"
          maxLength={200}
        />
        <button className="primary" onClick={add} disabled={!label.trim()}>
          Add
        </button>
      </div>
    </section>
  );
}

// ---- Insights ----

const SCORE_KEYS = ['mood', 'energy', 'sleep', 'cravings', 'pain'] as const;
type ScoreKey = (typeof SCORE_KEYS)[number];

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/** Compare metrics on full-protocol days vs lighter days. Positive deltas only —
 * this view exists to show her what's working, never to scold. */
function whatsWorking(rows: TrendRow[]): { label: string; delta: number; full: number; other: number }[] {
  const labels: Record<ScoreKey, string> = {
    mood: 'Mood',
    energy: 'Energy',
    sleep: 'Sleep',
    cravings: 'Fewer cravings',
    pain: 'Less pain',
  };
  const scored = rows.filter((r) => r.protocolRequired > 0);
  const fullDays = scored.filter((r) => r.protocolDone >= r.protocolRequired);
  const otherDays = scored.filter((r) => r.protocolDone < r.protocolRequired);
  if (fullDays.length < 3 || otherDays.length < 3) return [];
  const out: { label: string; delta: number; full: number; other: number }[] = [];
  for (const key of SCORE_KEYS) {
    const f = avg(fullDays.map((r) => r[key]).filter((v): v is number => typeof v === 'number'));
    const o = avg(otherDays.map((r) => r[key]).filter((v): v is number => typeof v === 'number'));
    if (f !== null && o !== null && f - o >= 0.3) out.push({ label: labels[key], delta: f - o, full: f, other: o });
  }
  return out.sort((a, b) => b.delta - a.delta);
}

function Insights() {
  const [rows, setRows] = useState<TrendRow[] | null>(null);
  useEffect(() => {
    api.trends().then((r) => setRows(r.rows)).catch(() => setRows([]));
  }, []);

  if (!rows) return <div className="card">Loading…</div>;
  if (rows.length < 2)
    return (
      <div className="card">
        <h2>Insights</h2>
        <p className="note">
          This page fills in as check-ins accumulate — a chart per feeling, with luteal days shaded so
          patterns against your cycle show up on their own. No minimum required; it works with whatever you
          give it.
        </p>
      </div>
    );

  const working = whatsWorking(rows);

  return (
    <>
      {working.length > 0 && (
        <section className="card">
          <h2>What the protocol is doing</h2>
          <p className="note">Days when the full protocol happened, compared with lighter days:</p>
          <div className="working-chips">
            {working.map((w) => (
              <div className="working-chip" key={w.label}>
                <span className="delta">+{w.delta.toFixed(1)}</span>
                <span className="what">{w.label}</span>
                <span className="vs">
                  {w.full.toFixed(1)} vs {w.other.toFixed(1)} of 5
                </span>
              </div>
            ))}
          </div>
          <p className="note">Correlation, honestly labeled — but it's your data, telling your story.</p>
        </section>
      )}
      {working.length === 0 && rows.length >= 6 && (
        <section className="card">
          <h2>What the protocol is doing</h2>
          <p className="note">
            No single pattern stands out yet — that's normal early on. The comparison sharpens as full and
            lighter days both accumulate.
          </p>
        </section>
      )}
      <section className="card">
        <h2>Last {rows.length} check-ins</h2>
        {METRICS.map(([key, label]) => (
          <Spark key={key} metric={key as keyof TrendRow} label={label} rows={rows} />
        ))}
        <p className="note">Shaded band = luteal days. Higher is better on every scale (cravings and pain are scored as relief).</p>
        <details className="data-table">
          <summary>View as table</summary>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Day</th><th>Mood</th><th>Energy</th><th>Sleep</th><th>Cravings</th><th>Pain</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  <td>{r.date}</td><td>{r.cycleDay ?? ''}</td><td>{r.mood ?? ''}</td><td>{r.energy ?? ''}</td>
                  <td>{r.sleep ?? ''}</td><td>{r.cravings ?? ''}</td><td>{r.pain ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </>
  );
}

// ---- Cycle ----

function Cycle({ state, refresh }: { state: State; refresh: () => void }) {
  const [date, setDate] = useState(state.today);
  const feedUrl = useMemo(() => `${location.origin}/calendar.ics?k=${accessKey()}`, []);
  const [copied, setCopied] = useState(false);

  async function logPeriod() {
    await api.period(date);
    refresh();
  }

  return (
    <>
      <section className="card">
        <h2>Log a period start</h2>
        <p className="note">
          The one entry that matters most: it re-anchors cycle day 1, the luteal block, SP6, and the
          subscribed calendar — everything reorients on its own.
        </p>
        <input type="date" value={date} max={state.today} onChange={(e) => setDate(e.target.value)} aria-label="Period start date" />
        <button className="primary" onClick={logPeriod}>
          Period started this day
        </button>
      </section>
      <section className="card">
        <h2>History</h2>
        {[...state.cycleStarts].reverse().map((s) => (
          <div className="supply-head" key={s}>
            <span>{s}</span>
            <button className="ghost" onClick={() => api.removePeriod(s).then(refresh)}>
              Remove
            </button>
          </div>
        ))}
        {state.cycle && (
          <p className="note">
            Estimated cycle length: {state.cycle.cycleLen} days (refines automatically as more cycles are
            logged). Next period expected around {state.cycle.nextPeriodDate}.
          </p>
        )}
      </section>
      <section className="card">
        <h2>Calendar subscription</h2>
        <p className="note">
          Subscribe once and the protocol lives in your own calendar — morning and evening reminders, phase
          changes, and reorder alerts, always in sync with what you log here. Google Calendar: Settings → Add
          calendar → From URL. iPhone: Settings → Calendar → Accounts → Add subscribed calendar.
        </p>
        <div className="copy-row">
          <code>{`${location.origin}/calendar.ics?k=…`}</code>
          <button
            className="ghost"
            onClick={() => {
              navigator.clipboard.writeText(feedUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
        <p className="note">The link contains the access key — treat it like a password.</p>
      </section>
    </>
  );
}

// ---- Supplies ----

const STATUS_LABEL = { ok: '● Stocked', reorder: '◐ Order soon', critical: '○ Order now' } as const;

function Supplies({ state, refresh }: { state: State; refresh: () => void }) {
  const [editing, setEditing] = useState<Item | null>(null);
  const [qty, setQty] = useState(30);

  async function restock(item: Item) {
    await api.supply(item, qty, state.today);
    setEditing(null);
    refresh();
  }

  return (
    <section className="card">
      <h2>On hand</h2>
      {state.supplies.map((s) => (
        <div className="supply-row" key={s.item}>
          <div className="supply-head">
            <span className="name">{s.label}</span>
            <span className={`pill ${s.status}`}>{STATUS_LABEL[s.status]}</span>
          </div>
          <div className="meter">
            <i style={{ width: `${Math.min((s.daysLeft / 45) * 100, 100)}%` }} />
          </div>
          <span className="supply-sub">
            ~{s.remaining} doses · about {s.daysLeft} days · a good order-by date is {s.reorderDate}
          </span>
          {editing === s.item ? (
            <div className="copy-row">
              <input type="number" min={1} max={500} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label="Doses in the new pack" />
              <button className="primary" onClick={() => restock(s.item)}>
                Opened today
              </button>
              <button className="ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="ghost"
              onClick={() => {
                setEditing(s.item);
                setQty(s.item === 'elix' ? 15 : 30);
              }}
            >
              New pack opened
            </button>
          )}
        </div>
      ))}
      <p className="note">Estimates come from your check-offs, so they're generous by nature — the calendar's reorder nudges carry a buffer.</p>
    </section>
  );
}
