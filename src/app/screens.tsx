import { useState } from "react";
import { Link } from "react-router-dom";
import type { Discipline } from "@shared/types";
import { useDemo, demoName } from "../lib/demo";
import { cn, Tag } from "../components/ui";
import {
  Avatar,
  Card,
  daysUntil,
  fmtDate,
  ProgressBar,
  ScreenHeader,
  Stagger,
  StaggerItem,
  StatusDot,
} from "./widgets";

/* ================= TODAY ================= */
export function TodayScreen() {
  const { data } = useDemo();
  if (!data) return null;
  const name = demoName().split(" ")[0] || "neighbor";

  const alerts = [
    ...data.events
      .filter((e) => e.status === "closing-soon")
      .map((e) => ({ kind: "deadline", text: `${e.name.split("—")[0].trim()} entry closes`, when: e.entryDeadline, to: "/app/draw" })),
    ...data.horses
      .filter((h) => h.farrierDueDays <= 10)
      .map((h) => ({ kind: "horse", text: `${h.barnName} — farrier due`, when: `in ${h.farrierDueDays}d`, to: "/app/tack" })),
    ...data.horses
      .filter((h) => !h.vaccinationsCurrent)
      .map((h) => ({ kind: "horse", text: `${h.barnName} — Coggins/vax expiring`, when: "action", to: "/app/tack" })),
  ].slice(0, 4);

  const s = data.season;
  const stats = [
    { n: `$${(s.spend / 1000).toFixed(1)}k`, l: "Season spend" },
    { n: s.eventsEntered, l: "Events entered" },
    { n: s.buckles, l: "Buckles won" },
    { n: `${(s.milesTraveled / 1000).toFixed(1)}k`, l: "Miles hauled" },
  ];

  return (
    <div>
      <ScreenHeader eyebrow="The Hollis Family · Stephenville, TX" title={`Howdy, ${name}.`} />

      <Card className="mb-4 bg-gradient-to-br from-leather to-ink text-bone">
        <div className="text-[11px] uppercase tracking-widest text-gold">This season together</div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {stats.map((st) => (
            <div key={st.l}>
              <div className="font-display text-2xl font-bold">{st.n}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-wide text-bone/55">{st.l}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink">Next up</h2>
        <span className="text-[11px] text-ink/40">{alerts.length} need attention</span>
      </div>
      <Stagger>
        {alerts.map((a, i) => (
          <StaggerItem key={i}>
            <Link to={a.to}>
              <Card onClick={() => {}} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={cn("grid h-9 w-9 place-items-center rounded-full text-sm", a.kind === "deadline" ? "bg-rust/12 text-rust" : "bg-sage/15 text-sage-deep")}>
                    {a.kind === "deadline" ? "⏱" : "🐴"}
                  </span>
                  <span className="text-sm font-semibold text-ink">{a.text}</span>
                </div>
                <span className="text-xs font-semibold text-rust">{a.when.startsWith("in") || a.when === "action" ? a.when : fmtDate(a.when)}</span>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {[
          { to: "/app/buckle", t: "Buckle Board", d: "3 ladders running", emoji: "🏆" },
          { to: "/app/sponsor", t: "Sponsor Pen", d: "1 renewal due", emoji: "✨" },
          { to: "/app/gatepost", t: "The Gatepost", d: "2 arenas need you", emoji: "📣" },
          { to: "/app/import", t: "Import data", d: "Bring your history", emoji: "↥" },
        ].map((q) => (
          <Link key={q.to} to={q.to}>
            <Card onClick={() => {}} className="h-full">
              <div className="text-2xl">{q.emoji}</div>
              <div className="mt-2 font-display font-bold text-ink">{q.t}</div>
              <div className="text-xs text-ink/50">{q.d}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ================= THE DRAW ================= */
const FILTERS: Array<"All" | Discipline> = ["All", "Barrel Racing", "Breakaway Roping", "Tie-Down Roping", "Team Roping", "Goat Tying"];

export function DrawScreen() {
  const { data } = useDemo();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [added, setAdded] = useState<Record<string, boolean>>({});
  if (!data) return null;

  const events = data.events
    .filter((e) => filter === "All" || e.disciplines.includes(filter as Discipline))
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div>
      <ScreenHeader eyebrow="The Draw" title="Every event, one feed" />
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              filter === f ? "bg-rust text-bone" : "bg-ink/6 text-ink/60 hover:bg-ink/10",
            )}
          >
            {f === "All" ? "All" : f.replace(" Racing", "").replace(" Roping", "")}
          </button>
        ))}
      </div>

      <Stagger>
        {events.map((e) => {
          const isAdded = added[e.id] ?? e.added;
          const d = daysUntil(e.entryDeadline);
          return (
            <StaggerItem key={e.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusDot status={e.status} />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-saddle/70">{e.association}</span>
                    </div>
                    <h3 className="mt-1 font-display text-lg font-bold leading-tight text-ink">{e.name}</h3>
                    <div className="text-xs text-ink/50">{e.venue} · {e.city}, {e.state}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xl font-bold text-rust">{fmtDate(e.startDate)}</div>
                    <div className="text-[10px] text-ink/45">${e.feePerEvent}/event</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.disciplines.slice(0, 3).map((d2) => (
                    <span key={d2} className="rounded-full bg-sage/12 px-2 py-0.5 text-[10px] font-medium text-sage-deep">{d2}</span>
                  ))}
                  {e.disciplines.length > 3 && <span className="text-[10px] text-ink/40">+{e.disciplines.length - 3}</span>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-saddle/10 pt-3">
                  <span className={cn("text-xs font-semibold", d <= 3 ? "text-rust" : "text-ink/55")}>
                    {e.drawPosted ? "✓ Draw posted" : d >= 0 ? `Entry closes in ${d}d` : "Entry closed"}
                  </span>
                  <button
                    onClick={() => setAdded((a) => ({ ...a, [e.id]: !isAdded }))}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition",
                      isAdded ? "bg-sage/15 text-sage-deep" : "bg-ink text-bone hover:bg-leather",
                    )}
                  >
                    {isAdded ? "✓ Entered" : "Enter"}
                  </button>
                </div>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}

/* ================= BUCKLE BOARD ================= */
const ladderTone = { "on-track": "sage", "at-risk": "gold", qualified: "turq", watch: "gold" } as const;

export function BuckleScreen() {
  const { data } = useDemo();
  if (!data) return null;
  const byId = Object.fromEntries(data.contestants.map((c) => [c.id, c]));

  return (
    <div>
      <ScreenHeader eyebrow="The Buckle Board" title="Road to the buckle" />
      <Stagger>
        {data.ladders.map((l) => {
          const c = byId[l.contestantId];
          const pct = Math.round((l.currentPoints / l.targetPoints) * 100);
          const dd = daysUntil(l.nextDeadline);
          return (
            <StaggerItem key={l.id}>
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar seed={c.avatarSeed} name={c.firstName} size={34} />
                    <div>
                      <div className="font-display font-bold leading-tight text-ink">{c.firstName} · {l.discipline}</div>
                      <div className="text-[11px] text-ink/50">{l.pathway} · {l.standing}</div>
                    </div>
                  </div>
                  <Tag tone={ladderTone[l.status]}>{l.status.replace("-", " ")}</Tag>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs font-semibold text-ink/60">
                    <span>{l.currentPoints} / {l.targetPoints} pts</span>
                    <span className={dd <= 7 ? "text-rust" : ""}>{l.nextDeadlineLabel} · {dd}d</span>
                  </div>
                  <ProgressBar pct={pct} tone={ladderTone[l.status]} />
                </div>

                <div className="mt-4 space-y-2.5">
                  {l.stages.map((st) => (
                    <div key={st.label} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                          st.state === "done" ? "bg-sage text-white" : st.state === "current" ? "bg-rust text-white [animation:pulse-ring_2s_infinite]" : "bg-ink/10 text-ink/40",
                        )}
                      >
                        {st.state === "done" ? "✓" : "•"}
                      </span>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-ink">{st.label}</div>
                        <div className="text-[11px] text-ink/45">{st.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}

/* ================= TACK ROOM ================= */
export function TackScreen() {
  const { data } = useDemo();
  const [tab, setTab] = useState<"horses" | "runs">("horses");
  if (!data) return null;
  const riders = Object.fromEntries(data.contestants.map((c) => [c.id, c.firstName]));

  return (
    <div>
      <ScreenHeader eyebrow="The Tack Room" title="The barn" />
      <div className="mb-4 flex gap-2 rounded-full bg-ink/6 p-1 text-xs font-semibold">
        {(["horses", "runs"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("flex-1 rounded-full py-2 capitalize transition", tab === t ? "bg-bone text-ink shadow-card" : "text-ink/50")}>
            {t === "horses" ? "Horses" : "Run log"}
          </button>
        ))}
      </div>

      {tab === "horses" ? (
        <Stagger>
          {data.horses.map((h) => (
            <StaggerItem key={h.id}>
              <Card>
                <div className="flex items-center gap-3">
                  <Avatar seed={h.barnName} name={h.barnName} size={48} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-bold leading-none text-ink">{h.barnName}</h3>
                      {!h.vaccinationsCurrent && <Tag tone="rust">Coggins due</Tag>}
                    </div>
                    <div className="text-[11px] text-ink/50">{h.color} {h.breed} · {h.age} · {h.role}</div>
                    <div className="text-[10px] text-ink/40">Ridden by {h.riderId ? riders[h.riderId] : "—"}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Due label="Farrier" days={h.farrierDueDays} />
                  <Due label="Vet / Coggins" days={h.vetDueDays} />
                </div>
                <p className="mt-3 rounded-xl bg-paper/70 p-2.5 text-[11px] italic leading-snug text-ink/60">"{h.notes}"</p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <Stagger>
          {data.runs.map((r) => (
            <StaggerItem key={r.id}>
              <Card className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-ink/45">{fmtDate(r.date)} · {r.discipline}</div>
                  <div className="font-display font-bold text-ink">{riders[r.contestantId]} · {r.eventName.split("—")[0].trim()}</div>
                  <div className="text-[11px] text-ink/50">Ground: {r.footing}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl font-bold text-rust">{r.result}</div>
                  {r.placing && <div className="text-[11px] font-semibold text-sage-deep">{ordinal(r.placing)} · {r.points} pts</div>}
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

function Due({ label, days }: { label: string; days: number }) {
  const tone = days <= 7 ? "text-rust" : days <= 21 ? "text-gold" : "text-sage-deep";
  return (
    <div className="rounded-xl bg-paper/70 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-ink/45">{label}</div>
      <div className={cn("font-display text-base font-bold", tone)}>{days} days</div>
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
