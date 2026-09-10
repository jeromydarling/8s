import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, type PortalData, type PortalEvent } from "../lib/api";
import { track } from "../lib/track";
import { cn, Rowel } from "../components/ui";
import { Card, ScreenHeader } from "./widgets";

// The association's home: its families (bundled seats), its invite code, and
// — the part that makes the data trustworthy — its own events to verify, edit,
// and add. Anything an association confirms here shows as "Verified" to every
// family in the state.

const inputSm = "rounded-lg border border-saddle/20 bg-paper/60 px-2.5 py-1.5 text-sm text-ink outline-none focus:border-rust";
const fmt = (s?: string | null) => (s ? new Date(s.length <= 10 ? `${s}T00:00:00` : s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");

export function AssociationPortal() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<PortalData | null>(null);
  const [denied, setDenied] = useState(false);
  const [notice] = useState(() =>
    new URLSearchParams(window.location.search).get("upgrade") === "success" ? "Welcome aboard — your portal is live. Share your invite code and start verifying events." : "",
  );
  const [copied, setCopied] = useState(false);

  const load = () =>
    api
      .portal()
      .then((d) => {
        setData(d);
        setDenied(false);
      })
      .catch(() => setDenied(true));

  useEffect(() => {
    if (!user) return;
    load();
    track("portal_open");
  }, [user?.id]);

  if (loading) return null;
  if (!user || denied) {
    return (
      <div>
        <ScreenHeader eyebrow="Associations" title="Run your rodeos here" />
        <Card className="bg-gradient-to-br from-leather to-ink text-bone">
          <div className="flex items-center gap-3">
            <Rowel className="h-8 w-8 text-gold" />
            <div className="font-display text-lg font-bold">The site license</div>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-bone/80">
            <li>✓ Every family in your association gets the Family plan included.</li>
            <li>✓ You verify your own events — families see "Verified" instead of "AI-estimated".</li>
            <li>✓ One invite code, one link. No spreadsheets, no chasing entries.</li>
          </ul>
          <Link to="/app/more?upgrade=associations" className="mt-4 block w-full rounded-full bg-gold py-2.5 text-center text-xs font-bold uppercase tracking-wider text-ink">
            Get the site license — from $49/mo
          </Link>
          <p className="mt-2 text-center text-[11px] text-bone/55">Already a member family? Enter your code under More.</p>
        </Card>
      </div>
    );
  }
  if (!data) return <div className="py-16 text-center text-sm text-ink/40">Loading your portal…</div>;

  const inviteUrl = `https://8s.rodeo/app/more?join=${data.association.invite_code}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <ScreenHeader eyebrow="Association Portal" title={data.association.name} />
      {notice && <div className="mb-3 rounded-2xl bg-sage/12 p-3 text-sm font-semibold text-sage-deep">{notice}</div>}

      {/* Invite code + seats */}
      <Card className="mb-4 bg-gradient-to-br from-leather to-ink text-bone">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-gold">Family invite code</div>
            <div className="mt-1 font-display text-3xl font-bold tracking-wider">{data.association.invite_code}</div>
            <div className="mt-1 text-[11px] text-bone/60">Families enter this under More (or use the link) — the Family plan is included for them.</div>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold">{data.seats.used}<span className="text-base text-bone/50">/{data.seats.limit}</span></div>
            <div className="text-[9px] uppercase tracking-widest text-bone/55">Seats</div>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={copy} className="flex-1 rounded-full bg-bone py-2 text-xs font-bold uppercase tracking-wider text-ink">{copied ? "✓ Copied link" : "Copy invite link"}</button>
          <button
            onClick={async () => {
              if (!confirm("Rotate the code? The old one stops working.")) return;
              await api.portalRotateCode().catch(() => {});
              load();
            }}
            className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-bone/80"
          >
            Rotate
          </button>
        </div>
      </Card>

      <EventsSection data={data} onChange={load} />
      <CorrectionsSection data={data} onChange={load} />
      <FamiliesSection data={data} onChange={load} />
    </div>
  );
}

/* ---------- Events: verify / edit / add ---------- */
function EventsSection({ data, onChange }: { data: PortalData; onChange: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const unverified = data.events.filter((e) => !e.verified_at).length;
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-end justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Your events</h2>
          <div className="text-[11px] text-ink/50">
            {unverified > 0 ? `${unverified} still AI-estimated — confirm them so families see "Verified".` : "Everything's verified. Families are seeing the real thing."}
          </div>
        </div>
        <button onClick={() => setAdding((a) => !a)} className="rounded-full bg-rust px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-bone">
          {adding ? "Close" : "+ Add event"}
        </button>
      </div>
      {adding && <AddEventForm defaultState={data.association.state} onDone={() => { setAdding(false); onChange(); }} />}
      <div className="space-y-2">
        {data.events.length === 0 && <div className="rounded-2xl bg-paper p-5 text-center text-xs text-ink/45">No events yet — add your season above.</div>}
        {data.events.map((e) => (
          <EventRow key={e.id} e={e} editing={editing === e.id} onEdit={() => setEditing(editing === e.id ? null : e.id)} onChange={() => { setEditing(null); onChange(); }} />
        ))}
      </div>
    </div>
  );
}

function EventRow({ e, editing, onEdit, onChange }: { e: PortalEvent; editing: boolean; onEdit: () => void; onChange: () => void }) {
  const [f, setF] = useState({ entry_deadline: e.entry_deadline ?? "", start_date: e.start_date ?? "", end_date: e.end_date ?? "", venue: e.venue ?? "", fee_per_event: String(e.fee_per_event ?? "") });
  const [busy, setBusy] = useState(false);
  async function save(fields: Record<string, string | number>) {
    setBusy(true);
    try {
      await api.portalVerifyEvent(e.id, fields);
      track("portal_event_verified", { edited: Object.keys(fields).length > 0 });
      onChange();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className={cn(e.verified_at ? "border-sage/30" : "border-gold/40 bg-gold/[0.05]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-display font-bold text-ink">{e.name}</div>
          <div className="text-[11px] text-ink/50">{[e.venue, e.city, e.state].filter(Boolean).join(" · ")} · starts {fmt(e.start_date)} · entries close {fmt(e.entry_deadline)}</div>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", e.verified_at ? "bg-sage/15 text-sage-deep" : "bg-gold/20 text-saddle")}>
          {e.verified_at ? "✓ Verified" : "AI-estimated"}
        </span>
      </div>
      {!editing ? (
        <div className="mt-3 flex gap-2">
          {!e.verified_at && (
            <button onClick={() => save({})} disabled={busy} className="flex-1 rounded-full bg-sage py-2 text-[11px] font-bold uppercase tracking-wider text-bone disabled:opacity-50">
              {busy ? "…" : "Confirm as-is"}
            </button>
          )}
          <button onClick={onEdit} className="flex-1 rounded-full bg-ink/8 py-2 text-[11px] font-semibold text-ink/70">{e.verified_at ? "Edit" : "Fix & verify"}</button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Entries close<input type="date" value={f.entry_deadline} onChange={(x) => setF({ ...f, entry_deadline: x.target.value })} className={cn(inputSm, "mt-0.5 w-full")} /></label>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Fee / event<input type="number" value={f.fee_per_event} onChange={(x) => setF({ ...f, fee_per_event: x.target.value })} className={cn(inputSm, "mt-0.5 w-full")} /></label>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Starts<input type="date" value={f.start_date} onChange={(x) => setF({ ...f, start_date: x.target.value })} className={cn(inputSm, "mt-0.5 w-full")} /></label>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Ends<input type="date" value={f.end_date} onChange={(x) => setF({ ...f, end_date: x.target.value })} className={cn(inputSm, "mt-0.5 w-full")} /></label>
          </div>
          <input value={f.venue} onChange={(x) => setF({ ...f, venue: x.target.value })} placeholder="Venue" className={cn(inputSm, "w-full")} />
          <div className="flex gap-2">
            <button
              onClick={() => save({ ...f, fee_per_event: Number(f.fee_per_event) || 0 })}
              disabled={busy}
              className="flex-1 rounded-full bg-rust py-2 text-[11px] font-bold uppercase tracking-wider text-bone disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save & verify"}
            </button>
            <button onClick={onEdit} className="rounded-full bg-ink/8 px-4 py-2 text-[11px] font-semibold text-ink/60">Cancel</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function AddEventForm({ defaultState, onDone }: { defaultState: string | null; onDone: () => void }) {
  const [f, setF] = useState({ name: "", venue: "", city: "", state: defaultState ?? "", start_date: "", end_date: "", entry_deadline: "", fee_per_event: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit() {
    setBusy(true);
    setErr("");
    try {
      await api.portalCreateEvent({ ...f, fee_per_event: Number(f.fee_per_event) || 0 });
      track("portal_event_created");
      onDone();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mb-3 border-rust/25 bg-rust/[0.03]">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-rust">New event — verified on save</div>
      <div className="grid grid-cols-2 gap-2">
        <input value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} placeholder="Event name *" className={cn(inputSm, "col-span-2")} />
        <input value={f.venue} onChange={(x) => setF({ ...f, venue: x.target.value })} placeholder="Venue" className={inputSm} />
        <input value={f.city} onChange={(x) => setF({ ...f, city: x.target.value })} placeholder="City *" className={inputSm} />
        <input value={f.state} onChange={(x) => setF({ ...f, state: x.target.value.toUpperCase() })} placeholder="State *" maxLength={2} className={cn(inputSm, "uppercase")} />
        <input type="number" value={f.fee_per_event} onChange={(x) => setF({ ...f, fee_per_event: x.target.value })} placeholder="Fee / event" className={inputSm} />
        <label className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Starts *<input type="date" value={f.start_date} onChange={(x) => setF({ ...f, start_date: x.target.value })} className={cn(inputSm, "mt-0.5 w-full")} /></label>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Ends<input type="date" value={f.end_date} onChange={(x) => setF({ ...f, end_date: x.target.value })} className={cn(inputSm, "mt-0.5 w-full")} /></label>
        <label className="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-ink/45">Entries close<input type="date" value={f.entry_deadline} onChange={(x) => setF({ ...f, entry_deadline: x.target.value })} className={cn(inputSm, "mt-0.5 w-full")} /></label>
      </div>
      {err && <p className="mt-2 text-xs font-semibold text-rust">{err}</p>}
      <button onClick={submit} disabled={busy || !f.name || !f.city || !f.state || !f.start_date} className="mt-3 w-full rounded-full bg-rust py-2.5 text-xs font-bold uppercase tracking-wider text-bone disabled:opacity-50">
        {busy ? "Saving…" : "Add verified event"}
      </button>
    </Card>
  );
}

/* ---------- Corrections families sent in ---------- */
function CorrectionsSection({ data, onChange }: { data: PortalData; onChange: () => void }) {
  if (data.corrections.length === 0) return null;
  async function review(id: string, action: "approve" | "reject") {
    await api.portalReviewCorrection(id, action).catch(() => {});
    onChange();
  }
  return (
    <div className="mb-5">
      <h2 className="mb-2 font-display text-lg font-bold text-ink">Families flagged these</h2>
      <div className="space-y-2">
        {data.corrections.map((c) => (
          <Card key={c.id} className="border-gold/40 bg-gold/[0.05]">
            <div className="text-[11px] uppercase tracking-widest text-saddle/70">{c.target_name ?? c.target_id}</div>
            <div className="mt-1 text-sm text-ink"><span className="font-semibold">{c.field.replace(/_/g, " ")}</span>{c.suggested_value ? ` → ${c.suggested_value}` : ""}</div>
            {c.note && <div className="mt-1 text-[12px] text-ink/60">"{c.note}"</div>}
            <div className="mt-2 flex gap-2">
              <button onClick={() => review(c.id, "approve")} className="flex-1 rounded-full bg-sage py-1.5 text-[11px] font-bold uppercase tracking-wider text-bone">Apply & verify</button>
              <button onClick={() => review(c.id, "reject")} className="rounded-full bg-ink/8 px-4 py-1.5 text-[11px] font-semibold text-ink/60">Dismiss</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- Families on the license ---------- */
function FamiliesSection({ data, onChange }: { data: PortalData; onChange: () => void }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 font-display text-lg font-bold text-ink">Families ({data.families.length})</h2>
      {data.families.length === 0 ? (
        <div className="rounded-2xl bg-paper p-5 text-center text-xs text-ink/45">No families yet — share the invite link at your next rodeo.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-saddle/15 bg-bone">
          {data.families.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 border-b border-saddle/8 px-3 py-2 last:border-0">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{f.name || f.email}</div>
                <div className="truncate text-[11px] text-ink/45">{f.email}{f.state ? ` · ${f.state}` : ""} · {f.plan_source === "association" ? "bundled" : f.plan}</div>
              </div>
              <button
                onClick={async () => {
                  if (!confirm(`Remove ${f.name || f.email} from the license?`)) return;
                  await api.portalRemoveFamily(f.id).catch(() => {});
                  onChange();
                }}
                className="shrink-0 text-[11px] text-ink/35 hover:text-rust"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
