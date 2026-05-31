import { useState } from "react";
import { Link } from "react-router-dom";
import type { ImportResult } from "@shared/types";
import { useDemo } from "../lib/demo";
import { api } from "../lib/api";
import { cn, Rowel, Tag } from "../components/ui";
import { LazyRodeoMap } from "../components/LazyRodeoMap";
import { Avatar, Card, EmptyHint, ProgressBar, ScreenHeader, Stagger, StaggerItem, StatusDot } from "./widgets";

/* ================= MORE ================= */
export function MoreScreen() {
  const items = [
    { to: "/app/sponsor", t: "The Sponsor Pen", d: "Media kit & sponsor tracking", emoji: "✨" },
    { to: "/app/gatepost", t: "The Gatepost", d: "Arena preservation advocacy", emoji: "📣" },
    { to: "/app/budget", t: "Season Budget", d: "Track every dollar", emoji: "💵" },
    { to: "/app/import", t: "Import Data", d: "Bring years of history, any format", emoji: "↥" },
  ];
  return (
    <div>
      <ScreenHeader eyebrow="More rooms" title="The whole barn" />
      <Stagger>
        {items.map((it) => (
          <StaggerItem key={it.to}>
            <Link to={it.to}>
              <Card onClick={() => {}} className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-paper text-2xl">{it.emoji}</span>
                <div className="flex-1">
                  <div className="font-display text-lg font-bold text-ink">{it.t}</div>
                  <div className="text-xs text-ink/50">{it.d}</div>
                </div>
                <span className="text-ink/30">›</span>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <Card className="mt-6 bg-leather text-bone">
        <div className="flex items-center gap-3">
          <Rowel className="h-8 w-8 text-gold" />
          <div>
            <div className="font-display font-bold">You're on Arena Pro</div>
            <div className="text-xs text-bone/60">Unlimited kids, horses & sponsor tools</div>
          </div>
        </div>
      </Card>
      <Link to="/" className="mt-4 block text-center text-xs font-semibold uppercase tracking-widest text-ink/40">
        ← Back to 8s.rodeo
      </Link>
    </div>
  );
}

/* ================= SPONSOR PEN ================= */
const tierTone = { Bronze: "ink", Silver: "sage", Gold: "gold", Buckle: "rust" } as const;

export function SponsorScreen() {
  const { data } = useDemo();
  if (!data) return null;
  const rylee = data.contestants[0];
  const total = data.sponsors.reduce((s, x) => s + x.annualValue, 0);

  return (
    <div>
      <ScreenHeader eyebrow="The Sponsor Pen" title="Partners" />

      <Card className="mb-4 bg-gradient-to-br from-leather to-ink text-bone">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar seed={rylee.avatarSeed} name={rylee.firstName} size={44} />
            <div>
              <div className="font-display text-lg font-bold leading-none">{rylee.firstName} {rylee.lastName}</div>
              <div className="text-[11px] text-gold">#{rylee.backNumber} · {rylee.disciplines.join(" · ")}</div>
            </div>
          </div>
          <Rowel className="h-8 w-8 text-gold" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[[`$${(total / 1000).toFixed(1)}k`, "Annual value"], [String(data.sponsors.length), "Partners"], ["23", "Events"]].map(([n, l]) => (
            <div key={l} className="rounded-xl bg-white/10 py-2">
              <div className="font-display text-lg font-bold">{n}</div>
              <div className="text-[8px] uppercase tracking-widest text-bone/60">{l}</div>
            </div>
          ))}
        </div>
        <button className="mt-4 w-full rounded-full bg-bone py-2.5 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-white">
          Generate media kit (PDF)
        </button>
      </Card>

      <Stagger>
        {data.sponsors.map((sp) => (
          <StaggerItem key={sp.id}>
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-base font-bold text-ink">{sp.brand}</div>
                  <div className="text-[11px] text-ink/50">{sp.category} · ${sp.annualValue.toLocaleString()}/yr</div>
                </div>
                <Tag tone={tierTone[sp.tier]}>{sp.tier}</Tag>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] text-ink/55">
                  <span>Deliverables</span>
                  <span className={sp.status === "renewal-due" ? "font-semibold text-rust" : ""}>
                    {sp.status === "renewal-due" ? "Renewal due!" : `${sp.deliverablesDone}/${sp.deliverablesTotal} done`}
                  </span>
                </div>
                <ProgressBar pct={(sp.deliverablesDone / sp.deliverablesTotal) * 100} tone="gold" />
              </div>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

/* ================= GATEPOST ================= */
const arenaTone = { safe: "Safe", watch: "Watch", threatened: "Threatened", saved: "Saved" } as const;

export function GatepostScreen() {
  const { data } = useDemo();
  const [signed, setSigned] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  if (!data) return null;

  return (
    <div>
      <ScreenHeader eyebrow="The Gatepost" title="Stand the ground" />
      <p className="mb-4 font-serif text-sm leading-relaxed text-ink/60">
        Arenas are community anchors. When development or a noise complaint threatens one, families organize here
        — together.
      </p>

      <LazyRodeoMap
        className="mb-4 h-60 border border-saddle/20"
        selectedId={selected}
        onSelect={(id) => setSelected(id)}
        pins={data.arenas.map((a) => ({
          id: a.id,
          lat: a.lat,
          lng: a.lng,
          title: a.name,
          subtitle: `${a.city}, ${a.state}`,
          tone: (a.status === "threatened" ? "rust" : a.status === "saved" ? "turq" : a.status === "watch" ? "gold" : "sage") as
            | "rust"
            | "turq"
            | "gold"
            | "sage",
          active: a.id === selected,
        }))}
      />
      <div className="mb-4 flex flex-wrap gap-3 text-[10px] font-semibold text-ink/55">
        {[["rust", "Threatened"], ["gold", "Watch"], ["sage", "Safe"], ["turq", "Saved"]].map(([t, l]) => (
          <span key={l} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", t === "rust" ? "bg-rust" : t === "gold" ? "bg-gold" : t === "sage" ? "bg-sage" : "bg-turq")} />
            {l}
          </span>
        ))}
      </div>

      <Stagger>
        {data.arenas.map((a) => {
          const isSigned = signed[a.id];
          const sig = a.signatures + (isSigned ? 1 : 0);
          const pct = a.signatureGoal ? (sig / a.signatureGoal) * 100 : 100;
          return (
            <StaggerItem key={a.id}>
              <Card className={cn(a.status === "threatened" && "border-rust/30 bg-rust/[0.03]")}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusDot status={a.status} />
                      <span className="text-[11px] font-bold uppercase tracking-wide text-ink/60">{arenaTone[a.status]}</span>
                    </div>
                    <h3 className="mt-1 font-display text-lg font-bold leading-tight text-ink">{a.name}</h3>
                    <div className="text-[11px] text-ink/50">{a.city}, {a.state} · {a.yearsActive} years</div>
                  </div>
                  <div className="text-right text-[11px]">
                    <div className="text-ink/40">Annual impact</div>
                    <div className="font-display text-base font-bold text-sage-deep">${(a.economicImpact / 1e6).toFixed(1)}M</div>
                  </div>
                </div>
                <p className="mt-2 text-[12px] leading-snug text-ink/65">{a.story}</p>

                {a.status === "threatened" && (
                  <>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px] font-semibold text-ink/60">
                        <span>{sig.toLocaleString()} signatures</span>
                        <span>goal {a.signatureGoal.toLocaleString()}</span>
                      </div>
                      <ProgressBar pct={pct} tone="rust" />
                    </div>
                    <button
                      onClick={() => setSigned((s) => ({ ...s, [a.id]: !isSigned }))}
                      className={cn(
                        "mt-3 w-full rounded-full py-2.5 text-xs font-bold uppercase tracking-wider transition",
                        isSigned ? "bg-sage/15 text-sage-deep" : "bg-ink text-bone hover:bg-leather",
                      )}
                    >
                      {isSigned ? "✓ Your name is in" : "Add my name + send a letter"}
                    </button>
                  </>
                )}
                {a.status === "saved" && (
                  <div className="mt-2 rounded-xl bg-sage/10 px-3 py-2 text-[11px] font-semibold text-sage-deep">
                    Won by {a.supporters.toLocaleString()} families who showed up. ✓
                  </div>
                )}
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}

/* ================= IMPORT (Cloudflare AI) ================= */
const SAMPLE = `Rider,Horse,Rodeo,Event,Time,Place,Date
Rylee Hollis,Dolly,Glen Rose Finals,Barrels,14.812,1,2026-05-24
Rylee Hollis,Boomer,Glen Rose Finals,Breakaway,2.61,3,2026-05-24
Cade Hollis,Chex,Lone Star Jackpot,Tie-Down,11.9,2,2026-05-17
Maelaina,Peanut,Glen Rose Finals,Barrels,19.43,4,2026-05-24`;

export function ImportScreen() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState("");

  async function run() {
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const r = await api.importData(text, "pasted-data.csv");
      setResult(r);
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ScreenHeader eyebrow="Import · Cloudflare AI" title="Bring your history" />
      <p className="mb-4 font-serif text-sm leading-relaxed text-ink/60">
        Paste years of results — a spreadsheet, a copied table, even hand-typed notes. AI reads the mess and
        turns it into clean records.
      </p>

      <Card className="mb-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="Paste anything here…"
          className="w-full resize-none rounded-xl border border-saddle/20 bg-paper/50 p-3 font-mono text-[11px] leading-relaxed text-ink outline-none focus:border-rust"
        />
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => setText(SAMPLE)} className="text-[11px] font-semibold text-turq underline-offset-4 hover:underline">
            Load sample data
          </button>
          <button
            onClick={run}
            disabled={busy || !text.trim()}
            className="rounded-full bg-rust px-5 py-2 text-xs font-bold uppercase tracking-wider text-bone transition hover:bg-ember disabled:opacity-40"
          >
            {busy ? "Synthesizing…" : "Synthesize with AI"}
          </button>
        </div>
      </Card>

      {busy && (
        <div className="grid place-items-center py-8">
          <Rowel className="h-8 w-8 animate-spin text-rust [animation-duration:1.2s]" />
          <p className="mt-3 text-xs text-ink/50">Reading your data…</p>
        </div>
      )}

      {err && <div className="rounded-2xl bg-rust/10 p-4 text-sm text-rust">{err}</div>}

      {result && (
        <div>
          <Card className="mb-3 bg-leather text-bone">
            <div className="text-[11px] uppercase tracking-widest text-gold">{result.mappedFrom}</div>
            <p className="mt-1 text-sm">{result.summary}</p>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[["contestants", result.detected.contestants], ["horses", result.detected.horses], ["events", result.detected.events], ["runs", result.detected.runs]].map(([l, n]) => (
                <div key={l as string} className="rounded-xl bg-white/10 py-2">
                  <div className="font-display text-lg font-bold">{n as number}</div>
                  <div className="text-[8px] uppercase tracking-widest text-bone/60">{l as string}</div>
                </div>
              ))}
            </div>
          </Card>
          {result.warnings.length > 0 && (
            <div className="mb-3 rounded-2xl bg-gold/15 p-3 text-[11px] text-saddle">
              {result.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
          <Stagger>
            {result.records.slice(0, 12).map((rec, i) => (
              <StaggerItem key={i}>
                <Card className="text-[12px]">
                  <span className="mr-2 rounded bg-turq/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-turq">{String(rec.type ?? "record")}</span>
                  <span className="text-ink/70">
                    {Object.entries(rec).filter(([k]) => k !== "type").map(([, v]) => v).filter(Boolean).join(" · ")}
                  </span>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
          {result.records.length === 0 && <EmptyHint>No records detected — try the sample.</EmptyHint>}
          <button className="mt-4 w-full rounded-full bg-ink py-3 text-xs font-bold uppercase tracking-wider text-bone">
            Confirm & import {result.records.length} records
          </button>
        </div>
      )}
    </div>
  );
}

/* ================= BUDGET ================= */
export function BudgetScreen() {
  const { data } = useDemo();
  if (!data) return null;
  const totalSpent = data.budget.reduce((s, b) => s + b.spent, 0);
  const totalBudget = data.budget.reduce((s, b) => s + b.budget, 0);

  return (
    <div>
      <ScreenHeader eyebrow="Season Budget" title="Every dollar" />
      <Card className="mb-4 bg-gradient-to-br from-leather to-ink text-bone">
        <div className="text-[11px] uppercase tracking-widest text-gold">Spent this season</div>
        <div className="font-display text-4xl font-bold">${totalSpent.toLocaleString()}</div>
        <div className="mt-2 text-xs text-bone/55">of ${totalBudget.toLocaleString()} planned</div>
        <div className="mt-3"><ProgressBar pct={(totalSpent / totalBudget) * 100} tone="gold" /></div>
      </Card>
      <Stagger>
        {data.budget.map((b) => (
          <StaggerItem key={b.category}>
            <Card>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-display font-bold text-ink">{b.category}</span>
                <span className="text-sm font-semibold text-ink/60">
                  ${b.spent.toLocaleString()} <span className="text-ink/35">/ ${b.budget.toLocaleString()}</span>
                </span>
              </div>
              <ProgressBar pct={(b.spent / b.budget) * 100} tone={b.spent > b.budget ? "rust" : "sage"} />
            </Card>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
