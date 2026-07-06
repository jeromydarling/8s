import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "../lib/auth";
import { AuthModal } from "../marketing/AuthModal";
import { cn, Rowel, Wordmark } from "../components/ui";
import { LazyRodeoMap } from "../components/LazyRodeoMap";
import {
  adminApi, healthTone, lifecycleTone, LIFECYCLES, LEAD_STAGES, PLAN_LABEL,
  type Customer, type CustomerDetail, type Lead, type Metrics, type Task,
} from "./api";

/* ---------- shared UI atoms ---------- */
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");
const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function Badge({ tone, children }: { tone: "rust" | "gold" | "sage" | "turq" | "ink"; children: ReactNode }) {
  const tones: Record<string, string> = {
    rust: "bg-rust/12 text-rust", gold: "bg-gold/20 text-saddle", sage: "bg-sage/15 text-sage-deep",
    turq: "bg-turq/15 text-turq", ink: "bg-ink/8 text-ink/60",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", tones[tone])}>{children}</span>;
}
function HealthDot({ h }: { h: number | null }) {
  return <span className={cn("font-display text-sm font-bold tabular-nums", healthTone(h))}>{h ?? "—"}</span>;
}

/* ---------- open-customer context (drawer reachable from any screen) ---------- */
const UICtx = createContext<{ open: (id: string) => void }>({ open: () => {} });
const useAdminUI = () => useContext(UICtx);

/* ============================ ROOT ============================ */
export default function AdminApp() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setState("denied");
      return;
    }
    adminApi.me().then((m) => setState(m.isAdmin ? "ok" : "denied"));
  }, [user, loading]);

  if (loading || state === "checking") return <Center>Loading the CRM…</Center>;

  if (state === "denied") {
    return (
      <Center>
        <div className="max-w-sm text-center">
          <Rowel className="mx-auto h-10 w-10 text-rust" />
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">Staff only</h1>
          <p className="mt-2 text-sm text-ink/60">
            {user ? "This account isn't on the admin allowlist." : "Sign in with an admin account to reach the CRM."}
          </p>
          {!user && (
            <button onClick={() => setAuthOpen(true)} className="mt-5 rounded-full bg-rust px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-bone">
              Sign in
            </button>
          )}
          <a href="/app" className="mt-3 block text-xs font-semibold uppercase tracking-widest text-ink/40">← Back to the app</a>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={() => setAuthOpen(false)} intent="Admin sign in" />
      </Center>
    );
  }
  return <Shell />;
}

function Center({ children }: { children: ReactNode }) {
  return <div className="grid min-h-[100svh] place-items-center bg-bone px-6">{children}</div>;
}

/* ============================ SHELL ============================ */
const NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/at-risk", label: "At-Risk" },
  { to: "/admin/map", label: "Map" },
  { to: "/admin/pipeline", label: "Pipeline" },
  { to: "/admin/tasks", label: "Tasks" },
];

function Shell() {
  const [focus, setFocus] = useState<string | null>(null);
  const ui = useMemo(() => ({ open: setFocus }), []);
  const location = useLocation();

  return (
    <UICtx.Provider value={ui}>
      <div className="min-h-[100svh] bg-bone text-ink md:flex">
        <aside className="sticky top-0 z-10 flex items-center gap-1 border-b border-saddle/12 bg-paper/60 px-3 py-2 md:h-[100svh] md:w-56 md:flex-col md:items-stretch md:gap-1 md:border-b-0 md:border-r md:py-5">
          <div className="mr-3 md:mb-6 md:mr-0 md:px-2">
            <Wordmark className="scale-90 origin-left" />
            <div className="hidden text-[10px] font-bold uppercase tracking-widest text-rust md:block">Command</div>
          </div>
          <nav className="flex flex-1 gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition",
                    isActive ? "bg-rust/10 text-rust" : "text-ink/55 hover:bg-ink/5 hover:text-ink",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <a href="/app" className="hidden px-3 text-[11px] font-semibold uppercase tracking-widest text-ink/35 hover:text-ink/60 md:mt-auto md:block">
            ← 8s.rodeo
          </a>
        </aside>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">
          <Routes location={location}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<CustomersScreen />} />
            <Route path="/at-risk" element={<AtRiskScreen />} />
            <Route path="/map" element={<MapScreen />} />
            <Route path="/pipeline" element={<PipelineScreen />} />
            <Route path="/tasks" element={<TasksScreen />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>

        {focus && <CustomerDrawer id={focus} onClose={() => setFocus(null)} />}
      </div>
    </UICtx.Provider>
  );
}

function H({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] font-bold uppercase tracking-widest text-rust">{eyebrow}</div>
      <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
    </div>
  );
}

/* ============================ DASHBOARD ============================ */
function Dashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [risk, setRisk] = useState<Customer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const { open } = useAdminUI();

  useEffect(() => {
    adminApi.metrics().then(setM).catch(() => {});
    adminApi.atRisk().then((d) => setRisk(d.customers.slice(0, 5))).catch(() => {});
    adminApi.tasks().then((d) => setTasks(d.tasks.filter((t) => !t.done_at).slice(0, 5))).catch(() => {});
  }, []);

  const maxSignup = Math.max(1, ...(m?.signups ?? []).map((s) => s.n));

  return (
    <div>
      <H eyebrow="Overview" title="The whole herd, at a glance" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="MRR" value={m ? money(m.mrr) : "—"} tone="sage" />
        <Tile label="ARR (run-rate)" value={m ? money(m.arr) : "—"} />
        <Tile label="Paying" value={m ? String(m.paying) : "—"} />
        <Tile label="Churn" value={m ? `${m.churnRate}%` : "—"} tone={m && m.churnRate > 8 ? "rust" : "ink"} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="Plans">
          {m &&
            Object.entries(m.planMix)
              .sort((a, b) => b[1] - a[1])
              .map(([plan, n]) => (
                <Bar key={plan} label={PLAN_LABEL[plan] ?? plan} n={n} max={m.totalUsers || 1} tone={plan === "free" ? "ink" : "sage"} />
              ))}
        </Panel>
        <Panel title="Signups / month">
          <div className="flex h-24 items-end gap-1">
            {(m?.signups ?? []).map((s) => (
              <div key={s.ym} className="flex flex-1 flex-col items-center gap-1" title={`${s.ym}: ${s.n}`}>
                <div className="w-full rounded-t bg-rust/70" style={{ height: `${(s.n / maxSignup) * 100}%` }} />
                <div className="text-[8px] text-ink/40">{s.ym.slice(5)}</div>
              </div>
            ))}
            {!m?.signups?.length && <div className="text-xs text-ink/40">No signups yet.</div>}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="Needs a human">
          {risk.length === 0 && <div className="text-xs text-ink/40">Everyone's healthy. 🤠</div>}
          {risk.map((c) => (
            <Row key={c.id} onClick={() => open(c.id)}>
              <span className="truncate text-sm font-semibold text-ink">{c.name || c.email}</span>
              <span className="flex items-center gap-2">
                <Badge tone={lifecycleTone(c.lifecycle)}>{c.lifecycle.replace("_", " ")}</Badge>
                <HealthDot h={c.health_score} />
              </span>
            </Row>
          ))}
        </Panel>
        <Panel title="Follow-ups due">
          {tasks.length === 0 && <div className="text-xs text-ink/40">No open tasks.</div>}
          {tasks.map((t) => (
            <Row key={t.id} onClick={() => t.user_id && open(t.user_id)}>
              <span className="truncate text-sm text-ink">{t.title}</span>
              <span className="text-[11px] text-ink/45">{fmtDate(t.due_date)}</span>
            </Row>
          ))}
        </Panel>
      </div>

      {m && (
        <div className="mt-4 flex flex-wrap gap-2">
          {m.topStates.map((s) => (
            <span key={s.state} className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/60">
              {s.state} · {s.n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, tone = "ink" }: { label: string; value: string; tone?: "ink" | "sage" | "rust" }) {
  const t = tone === "sage" ? "text-sage-deep" : tone === "rust" ? "text-rust" : "text-ink";
  return (
    <div className="rounded-2xl border border-saddle/15 bg-bone p-4 shadow-card">
      <div className="text-[10px] font-bold uppercase tracking-widest text-ink/45">{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-bold", t)}>{value}</div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-saddle/15 bg-bone p-4 shadow-card">
      <div className="mb-2 font-display text-sm font-bold text-ink">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Bar({ label, n, max, tone }: { label: string; n: number; max: number; tone: "sage" | "ink" }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[11px] text-ink/60">
        <span>{label}</span>
        <span className="font-semibold">{n}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-paper">
        <div className={cn("h-full rounded-full", tone === "sage" ? "bg-sage" : "bg-ink/25")} style={{ width: `${(n / max) * 100}%` }} />
      </div>
    </div>
  );
}
function Row({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-ink/5">
      {children}
    </button>
  );
}

/* ============================ CUSTOMERS ============================ */
function CustomersScreen() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("");
  const [lifecycle, setLifecycle] = useState("");
  const [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(true);
  const { open } = useAdminUI();

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      adminApi
        .customers({ query, plan, lifecycle, sort })
        .then((d) => setRows(d.customers))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [query, plan, lifecycle, sort]);

  return (
    <div>
      <H eyebrow="People" title="Customers" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email…"
          className="flex-1 rounded-xl border border-saddle/20 bg-white/70 px-3 py-2 text-sm outline-none focus:border-rust"
        />
        <Select value={plan} onChange={setPlan} opts={[["", "All plans"], ["free", "Free"], ["family", "Family"], ["pro", "Pro"], ["associations", "Assoc."]]} />
        <Select value={lifecycle} onChange={setLifecycle} opts={[["", "All stages"], ...LIFECYCLES.map((l) => [l, l.replace("_", " ")] as [string, string])]} />
        <Select value={sort} onChange={setSort} opts={[["recent", "Newest"], ["active", "Last active"], ["health", "Health ↑"], ["name", "Name"]]} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-saddle/15 bg-bone shadow-card">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-saddle/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-ink/40">
          <span>Customer</span><span>Plan</span><span>Stage</span><span>Health</span>
        </div>
        {loading && <div className="p-6 text-center text-xs text-ink/40">Loading…</div>}
        {!loading && rows.length === 0 && <div className="p-6 text-center text-xs text-ink/40">No matches.</div>}
        {rows.map((c) => (
          <button
            key={c.id}
            onClick={() => open(c.id)}
            className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-saddle/8 px-4 py-2.5 text-left transition last:border-0 hover:bg-ink/[0.03]"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{c.name || "—"}</span>
              <span className="block truncate text-[11px] text-ink/45">{c.email}{c.state ? ` · ${c.state}` : ""}</span>
            </span>
            <Badge tone={c.plan === "free" ? "ink" : "gold"}>{PLAN_LABEL[c.plan] ?? c.plan}</Badge>
            <Badge tone={lifecycleTone(c.lifecycle)}>{c.lifecycle.replace("_", " ")}</Badge>
            <HealthDot h={c.health_score} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Select({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border border-saddle/20 bg-white/70 px-2.5 py-2 text-sm outline-none focus:border-rust">
      {opts.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

/* ============================ AT-RISK ============================ */
function AtRiskScreen() {
  const [rows, setRows] = useState<Customer[]>([]);
  const { open } = useAdminUI();
  useEffect(() => {
    adminApi.atRisk().then((d) => setRows(d.customers)).catch(() => {});
  }, []);
  return (
    <div>
      <H eyebrow="Churn radar" title="Needs a human" />
      <p className="mb-4 -mt-3 text-sm text-ink/55">Low health, a failed payment, or a pending cancel. Reach out before they're gone.</p>
      {rows.length === 0 && <div className="rounded-2xl bg-sage/10 p-6 text-center text-sm text-sage-deep">Nobody's at risk right now. 🤠</div>}
      <div className="space-y-2">
        {rows.map((c) => (
          <button key={c.id} onClick={() => open(c.id)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-saddle/15 bg-bone p-3 text-left shadow-card transition hover:border-rust/30">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{c.name || c.email}</div>
              <div className="truncate text-[11px] text-ink/50">
                {PLAN_LABEL[c.plan] ?? c.plan}
                {c.plan_status ? ` · ${c.plan_status}` : ""} · last active {fmtDate(c.last_active_at)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={lifecycleTone(c.lifecycle)}>{c.lifecycle.replace("_", " ")}</Badge>
              <HealthDot h={c.health_score} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================ MAP ============================ */
function MapScreen() {
  const [pins, setPins] = useState<{ id: string; lat: number; lng: number; title: string; subtitle?: string; tone: "rust" | "gold" | "sage" | "turq" }[]>([]);
  const [approx, setApprox] = useState(0);
  const { open } = useAdminUI();
  useEffect(() => {
    adminApi.map().then((d) => {
      setPins(d.pins.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, title: String(p.name), subtitle: PLAN_LABEL[p.plan] ?? p.plan, tone: lifecycleTone(p.lifecycle) })));
      setApprox(d.pins.filter((p) => p.approx).length);
    }).catch(() => {});
  }, []);
  return (
    <div>
      <H eyebrow="Geography" title="Where your families ride" />
      <LazyRodeoMap className="h-[60vh] overflow-hidden rounded-2xl border border-saddle/20" pins={pins} onSelect={(id) => open(id)} />
      <p className="mt-2 text-[11px] text-ink/45">{pins.length} customers plotted{approx ? ` · ${approx} placed by state (no exact home set)` : ""}. Tap a pin to open the profile.</p>
    </div>
  );
}

/* ============================ PIPELINE ============================ */
function PipelineScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useEffect(() => {
    adminApi.leads().then((d) => setLeads(d.leads)).catch(() => {});
    adminApi.metrics().then(setMetrics).catch(() => {});
  }, []);
  async function setStage(id: string, stage: string) {
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage } : l)));
    await adminApi.setLeadStage(id, stage).catch(() => {});
  }
  return (
    <div>
      <H eyebrow="Funnel" title="Pipeline & lead inbox" />
      {metrics && (
        <div className="mb-5 grid grid-cols-3 gap-2 md:grid-cols-6">
          {LIFECYCLES.map((l) => (
            <div key={l} className="rounded-xl border border-saddle/15 bg-bone p-3 text-center shadow-card">
              <div className="font-display text-xl font-bold text-ink">{metrics.lifecycle[l] ?? 0}</div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-ink/45">{l.replace("_", " ")}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mb-2 font-display text-sm font-bold text-ink">Lead inbox ({leads.length})</div>
      <div className="space-y-2">
        {leads.length === 0 && <div className="rounded-2xl bg-paper p-6 text-center text-xs text-ink/40">No leads captured yet.</div>}
        {leads.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 rounded-2xl border border-saddle/15 bg-bone p-3 shadow-card">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{l.name} <span className="font-normal text-ink/45">· {l.email}</span></div>
              <div className="truncate text-[11px] text-ink/50">{[l.role, l.org, l.state, l.disciplines].filter(Boolean).join(" · ") || "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <a href={`mailto:${l.email}`} className="rounded-lg bg-rust/10 px-2.5 py-1.5 text-[11px] font-bold text-rust">Email</a>
              <Select value={l.stage} onChange={(s) => setStage(l.id, s)} opts={LEAD_STAGES.map((s) => [s, s] as [string, string])} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ TASKS ============================ */
function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const { open } = useAdminUI();
  const load = () => adminApi.tasks().then((d) => setTasks(d.tasks)).catch(() => {});
  useEffect(() => { load(); }, []);
  async function add() {
    if (!title.trim()) return;
    await adminApi.createTask(title.trim(), undefined, due || undefined).catch(() => {});
    setTitle(""); setDue(""); load();
  }
  async function toggle(id: string) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done_at: t.done_at ? null : new Date().toISOString() } : t)));
    await adminApi.toggleTask(id).catch(() => {});
  }
  return (
    <div>
      <H eyebrow="Follow-ups" title="Tasks" />
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a follow-up…" className="flex-1 rounded-xl border border-saddle/20 bg-white/70 px-3 py-2 text-sm outline-none focus:border-rust" />
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="rounded-xl border border-saddle/20 bg-white/70 px-3 py-2 text-sm outline-none focus:border-rust" />
        <button onClick={add} className="rounded-xl bg-rust px-4 py-2 text-xs font-bold uppercase tracking-wider text-bone">Add</button>
      </div>
      <div className="space-y-1.5">
        {tasks.map((t) => (
          <div key={t.id} className={cn("flex items-center gap-3 rounded-xl border border-saddle/12 bg-bone p-3 shadow-card", t.done_at && "opacity-55")}>
            <button onClick={() => toggle(t.id)} className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", t.done_at ? "border-sage bg-sage text-bone" : "border-saddle/40")}>
              {t.done_at ? "✓" : ""}
            </button>
            <div className="min-w-0 flex-1">
              <div className={cn("truncate text-sm text-ink", t.done_at && "line-through")}>{t.title}</div>
              {t.customer_email && (
                <button onClick={() => t.user_id && open(t.user_id)} className="text-[11px] text-rust hover:underline">
                  {t.customer_name || t.customer_email}
                </button>
              )}
            </div>
            <span className="text-[11px] text-ink/45">{fmtDate(t.due_date)}</span>
          </div>
        ))}
        {tasks.length === 0 && <div className="rounded-2xl bg-paper p-6 text-center text-xs text-ink/40">No tasks yet.</div>}
      </div>
    </div>
  );
}

/* ============================ CUSTOMER DRAWER ============================ */
function CustomerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<CustomerDetail | null>(null);
  const [tab, setTab] = useState<"note" | "email">("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const load = () => adminApi.customer(id).then(setD).catch(() => {});
  useEffect(() => { setD(null); load(); /* eslint-disable-next-line */ }, [id]);

  if (!d) {
    return (
      <Overlay onClose={onClose}>
        <div className="grid h-full place-items-center text-sm text-ink/40">Loading…</div>
      </Overlay>
    );
  }
  const u = d.user as Record<string, any>;
  const entered = d.watch.find((w) => w.status === "entered")?.n ?? 0;
  const following = d.watch.reduce((s, w) => s + w.n, 0);

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const r = await adminApi.message(id, tab, body.trim(), subject.trim() || undefined);
      setFlash(tab === "email" ? (r.delivered ? "Email sent." : "Logged (email not delivered — check config).") : "Note saved.");
      setBody(""); setSubject("");
      load();
    } catch (e) {
      setFlash(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }
  async function addTag() {
    if (!tag.trim()) return;
    await adminApi.addTag(id, tag.trim()).catch(() => {});
    setTag(""); load();
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start justify-between gap-3 border-b border-saddle/12 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-xl font-bold text-ink">{u.name || u.email}</h2>
            <HealthDot h={u.health_score} />
          </div>
          <div className="truncate text-[12px] text-ink/55">{u.email}{u.state ? ` · ${u.state}` : ""} · joined {fmtDate(u.created_at)}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={u.plan === "free" ? "ink" : "gold"}>{PLAN_LABEL[u.plan] ?? u.plan}</Badge>
            {u.plan_status && <Badge tone="ink">{u.plan_status}</Badge>}
            <select
              value={u.lifecycle}
              onChange={async (e) => { await adminApi.setLifecycle(id, e.target.value).catch(() => {}); load(); }}
              className="rounded-lg border border-saddle/20 bg-white/70 px-2 py-1 text-[11px] font-semibold outline-none focus:border-rust"
            >
              {LIFECYCLES.map((l) => <option key={l} value={l}>{l.replace("_", " ")}</option>)}
            </select>
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-ink/50 hover:bg-ink/10">✕</button>
      </div>

      <div className="space-y-5 overflow-y-auto p-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["Riders", d.contestants.length], ["Horses", d.horses.length], ["Following", following]].map(([l, n]) => (
            <div key={String(l)} className="rounded-xl bg-paper/70 py-2">
              <div className="font-display text-lg font-bold text-ink">{n as number}</div>
              <div className="text-[9px] uppercase tracking-wide text-ink/45">{l as string}</div>
            </div>
          ))}
        </div>
        {entered > 0 && <div className="text-[11px] text-ink/55">{entered} event{entered === 1 ? "" : "s"} entered · alerts {d.alertSub ? "on" : "off"}</div>}

        {/* Tags */}
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-ink/45">Tags</div>
          <div className="flex flex-wrap items-center gap-1.5">
            {d.tags.map((t) => (
              <button key={t} onClick={async () => { await adminApi.removeTag(id, t).catch(() => {}); load(); }} className="group rounded-full bg-turq/12 px-2 py-0.5 text-[11px] font-semibold text-turq">
                {t} <span className="text-turq/50 group-hover:text-rust">✕</span>
              </button>
            ))}
            <input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} placeholder="+ tag" className="w-20 rounded-full border border-saddle/20 bg-white/70 px-2 py-0.5 text-[11px] outline-none focus:border-rust" />
          </div>
        </div>

        {/* Composer */}
        <div className="rounded-2xl border border-saddle/15 bg-paper/40 p-3">
          <div className="mb-2 flex gap-1">
            {(["note", "email"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn("rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-wide", tab === t ? "bg-rust text-bone" : "text-ink/50 hover:bg-ink/5")}>
                {t === "note" ? "Note" : "Email"}
              </button>
            ))}
          </div>
          {tab === "email" && (
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="mb-2 w-full rounded-lg border border-saddle/20 bg-white/80 px-3 py-2 text-sm outline-none focus:border-rust" />
          )}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={tab === "email" ? `Write to ${u.name || u.email}…` : "Private note about this customer…"} className="w-full resize-none rounded-lg border border-saddle/20 bg-white/80 px-3 py-2 text-sm outline-none focus:border-rust" />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-sage-deep">{flash}</span>
            <button onClick={send} disabled={busy || !body.trim()} className="rounded-full bg-rust px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-bone disabled:opacity-40">
              {busy ? "…" : tab === "email" ? "Send email" : "Save note"}
            </button>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-ink/45">Timeline</div>
          <div className="space-y-2">
            {d.messages.length === 0 && <div className="text-xs text-ink/40">No history yet.</div>}
            {d.messages.map((m) => (
              <div key={m.id} className={cn("rounded-xl p-2.5", m.channel === "note" ? "bg-gold/10" : "bg-paper/70")}>
                <div className="mb-0.5 flex items-center justify-between text-[10px] text-ink/45">
                  <span className="font-bold uppercase tracking-wide">{m.channel === "note" ? "Note" : m.direction === "out" ? "Email sent" : "Reply"}{m.author ? ` · ${m.author}` : ""}</span>
                  <span>{new Date(m.created_at).toLocaleString()}</span>
                </div>
                {m.subject && <div className="text-[12px] font-semibold text-ink">{m.subject}</div>}
                <div className="whitespace-pre-wrap text-[12px] text-ink/70">{m.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-bone shadow-lift">{children}</div>
    </div>
  );
}
