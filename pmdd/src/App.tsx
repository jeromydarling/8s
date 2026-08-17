import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type State, type TrendRow } from './api';
import type { Item } from '../shared/protocol';
import { Spark } from './Spark';

type Tab = 'today' | 'checkin' | 'trends' | 'cycle' | 'supplies';

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            : 'Could not reach the server. Check your connection and pull to refresh.',
        ),
      );
  }, []);

  useEffect(refresh, [refresh]);

  return (
    <div className="shell">
      <header>
        <h1>PMDD Protocol</h1>
        {state?.cycle && (
          <p className="note">
            Cycle day {state.cycle.day} · {state.cycle.phase === 'luteal' ? 'Luteal' : 'Follicular'} phase
          </p>
        )}
      </header>

      {error && <div className="card">{error}</div>}

      {state && tab === 'today' && <Today state={state} refresh={refresh} />}
      {state && tab === 'checkin' && <CheckIn state={state} refresh={refresh} />}
      {tab === 'trends' && <Trends />}
      {state && tab === 'cycle' && <Cycle state={state} refresh={refresh} />}
      {state && tab === 'supplies' && <Supplies state={state} refresh={refresh} />}

      <nav className="nav" aria-label="Sections">
        {(
          [
            ['today', 'Today'],
            ['checkin', 'Check-in'],
            ['trends', 'Trends'],
            ['cycle', 'Cycle'],
            ['supplies', 'Supplies'],
          ] as [Tab, string][]
        ).map(([id, name]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {name}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ---- Today: the checklist ----

function Today({ state, refresh }: { state: State; refresh: () => void }) {
  const { cycle, doses, date } = state;

  async function toggle(item: Item, done: boolean) {
    await api.dose(date, item, done);
    refresh();
  }

  return (
    <>
      {cycle && (
        <div className={`phase-banner ${cycle.phase}`}>
          <span className="phase-line">
            {cycle.phase === 'luteal' ? 'Luteal phase' : 'Follicular phase'} — day {cycle.day}
          </span>
          <span className="sub">
            {cycle.phase === 'luteal'
              ? `SP6 is on. Period expected around ${cycle.nextPeriodDate}.`
              : `Luteal block (SP6 starts) ${cycle.lutealStartDate}.`}
          </span>
        </div>
      )}
      <section className="card">
        <h2>Morning — 7:00 AM</h2>
        {doses.map((d) => (
          <label key={d.item} className={`dose ${d.done ? 'done' : ''} ${d.optional ? 'optional' : ''}`}>
            <input type="checkbox" checked={d.done} onChange={(e) => toggle(d.item, e.target.checked)} />
            <span>
              <span className="dose-label">{d.label}</span>
              <br />
              <span className="dose-detail">{d.detail}</span>
            </span>
          </label>
        ))}
        <p className="note">Patches on clean, dry skin. Off and discarded by 7:00 PM — 12-hour max wear. Keep drinking water.</p>
      </section>
    </>
  );
}

// ---- Check-in ----

const METRICS: [keyof TrendRow & string, string, string, string][] = [
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
    <section className="card">
      <h2>How is today going?</h2>
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
        <label htmlFor="diet">Dietary observations</label>
        <textarea id="diet" value={diet} onChange={(e) => setDiet(e.target.value)} placeholder="What you ate, what you craved, what sat well or didn't…" />
      </div>
      <div className="slider-row">
        <label htmlFor="notes">Anything else</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Symptoms, stressors, wins…" />
      </div>
      <button className="primary" onClick={save}>
        Save today's check-in
      </button>
      {saved && <span className="saved-flash">Saved ✓</span>}
    </section>
  );
}

// ---- Trends ----

function Trends() {
  const [rows, setRows] = useState<TrendRow[] | null>(null);
  useEffect(() => {
    api.trends().then((r) => setRows(r.rows)).catch(() => setRows([]));
  }, []);

  if (!rows) return <div className="card">Loading…</div>;
  if (rows.length < 2)
    return (
      <div className="card">
        <h2>Trends</h2>
        <p className="note">Charts appear after a couple of check-ins. The shaded band marks luteal days, so patterns against the cycle show up at a glance.</p>
      </div>
    );

  return (
    <section className="card">
      <h2>Last {rows.length} check-ins</h2>
      {METRICS.map(([key, label]) => (
        <Spark key={key} metric={key} label={label} rows={rows} />
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
  );
}

// ---- Cycle ----

function Cycle({ state, refresh }: { state: State; refresh: () => void }) {
  const [date, setDate] = useState(state.today);
  const feedUrl = useMemo(() => `${location.origin}/calendar.ics?k=KEY`, []);
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
          This is the one entry that matters most: it re-anchors cycle day 1, the luteal block, SP6, and the
          subscribed calendar — everything reorients automatically.
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
            Estimated cycle length: {state.cycle.cycleLen} days (refines automatically as more cycles are logged).
            Next period expected around {state.cycle.nextPeriodDate}.
          </p>
        )}
      </section>
      <section className="card">
        <h2>Calendar subscription</h2>
        <p className="note">
          Subscribe once and the protocol lives in your own calendar app — morning and evening reminders, phase
          changes, and reorder alerts, always in sync with what you log here. In Google Calendar: Settings →
          Add calendar → From URL. On iPhone: Settings → Calendar → Accounts → Add subscribed calendar.
        </p>
        <div className="copy-row">
          <code>{feedUrl.replace('KEY', '…')}</code>
          <button
            className="ghost"
            onClick={() => {
              navigator.clipboard.writeText(feedUrl.replace('KEY', new URLSearchParams(location.search).get('k') ?? '…'));
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
            <span className={`pill ${s.status}`}>
              {s.status === 'ok' ? '● OK' : s.status === 'reorder' ? '▲ Reorder' : '✕ Critical'}
            </span>
          </div>
          <div className="meter">
            <i style={{ width: `${Math.min((s.daysLeft / 45) * 100, 100)}%` }} />
          </div>
          <span className="supply-sub">
            ~{s.remaining} doses · about {s.daysLeft} days · reorder by {s.reorderDate}
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
      <p className="note">
        Counts come from your checked-off doses, so keeping the Today list honest keeps these projections honest.
      </p>
    </section>
  );
}
