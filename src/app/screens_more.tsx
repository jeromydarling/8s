import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ImportResult } from "@shared/types";
import { useDemo } from "../lib/demo";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { track } from "../lib/track";
import { cn, Rowel, Tag } from "../components/ui";
import { AuthModal } from "../marketing/AuthModal";
import { LazyRodeoMap } from "../components/LazyRodeoMap";
import { Avatar, Card, EmptyHint, ProgressBar, SampleBanner, ScreenHeader, Stagger, StaggerItem, StatusDot } from "./widgets";

/* ================= MORE ================= */
export function MoreScreen() {
  const { user } = useAuth();
  const items = [
    { to: "/app/sponsor", t: "The Sponsor Pen", d: "Media kit & sponsor tracking", emoji: "✨" },
    { to: "/app/gatepost", t: "The Gatepost", d: "Arena preservation advocacy", emoji: "📣" },
    { to: "/app/budget", t: "Season Budget", d: "Track every dollar", emoji: "💵" },
    { to: "/app/import", t: "Import Data", d: "Bring years of history, any format", emoji: "↥" },
  ];
  return (
    <div>
      <ScreenHeader eyebrow="More rooms" title="The whole barn" />

      <BillingPanel />

      <AlertsPanel />

      <div className="mt-5">
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
      </div>

      {user && (
        <Card className="mt-6 bg-leather text-bone">
          <div className="flex items-center gap-3">
            <Rowel className="h-8 w-8 text-gold" />
            <div>
              <div className="font-display font-bold">{user.name || "Your hub"}</div>
              <div className="text-xs text-bone/60">{user.email}</div>
            </div>
          </div>
        </Card>
      )}
      <Link to="/" className="mt-4 block text-center text-xs font-semibold uppercase tracking-widest text-ink/40">
        ← Back to 8s.rodeo
      </Link>
    </div>
  );
}

/* Plan + Stripe billing. Upgrades go through Stripe Checkout; existing
   subscribers manage/cancel through the Stripe billing portal. Also handles the
   ?upgrade= deep link the marketing pricing page sends here. */
const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  family: "Arena Family",
  pro: "Arena Pro",
  associations: "Associations",
};
const PLAN_PRICE: Record<string, string> = { family: "$79/yr", pro: "$19.99/mo" };

function BillingPanel() {
  const { user, loading, refresh } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [authOpen, setAuthOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const pendingPlan = useRef<"family" | "pro" | "associations" | null>(null);
  const handledQuery = useRef(false);

  useEffect(() => {
    api.config().then((c) => setEnabled(!!c.billingEnabled)).catch(() => {});
  }, []);

  async function pause() {
    setBusy("pause");
    setNotice("");
    try {
      const { paused_until } = await api.pauseBilling();
      setNotice(`Paused — billing resumes ${new Date(paused_until).toLocaleDateString()}. Your season's still here.`);
      setSaveOpen(false);
      track("billing_paused");
      await refresh();
    } catch (e) {
      setNotice(String((e as Error).message ?? e));
    } finally {
      setBusy("");
    }
  }

  async function downgrade() {
    setBusy("downgrade");
    setNotice("");
    try {
      await api.downgradeBilling();
      setNotice("Set to switch to Free at your renewal date — you keep everything until then.");
      setSaveOpen(false);
      track("billing_downgraded");
      await refresh();
    } catch (e) {
      setNotice(String((e as Error).message ?? e));
    } finally {
      setBusy("");
    }
  }

  async function startCheckout(plan: "family" | "pro" | "associations") {
    setBusy(plan);
    setNotice("");
    try {
      const { url } = await api.checkout(plan);
      window.location.href = url;
    } catch (e) {
      setNotice(String((e as Error).message ?? e));
      setBusy("");
    }
  }

  async function manage() {
    setBusy("portal");
    try {
      const { url } = await api.billingPortal();
      window.location.href = url;
    } catch (e) {
      setNotice(String((e as Error).message ?? e));
      setBusy("");
    }
  }

  // Resolve the ?upgrade= intent once: success/cancel notices, or auto-launch
  // checkout for a chosen plan (opening the auth modal first if signed out).
  useEffect(() => {
    if (handledQuery.current) return;
    const params = new URLSearchParams(window.location.search);
    const up = params.get("upgrade");
    if (!up) return;

    if (up === "success" || up === "cancel") {
      handledQuery.current = true;
      window.history.replaceState({}, "", "/app/more");
      if (up === "success") {
        setNotice("You're upgraded — welcome aboard. 🤠");
        track("upgrade_success");
        refresh();
      } else {
        setNotice("No worries — you can upgrade any time.");
      }
      return;
    }
    if (up === "family" || up === "pro" || up === "associations") {
      if (loading) return; // wait for /api/me so signed-in users skip the modal
      handledQuery.current = true;
      window.history.replaceState({}, "", "/app/more");
      track("upgrade_intent", { plan: up });
      if (user) startCheckout(up);
      else {
        pendingPlan.current = up;
        setAuthOpen(true);
      }
    }
  }, [user, loading, refresh]);

  const plan = user?.plan ?? "free";
  const isPaid = plan !== "free";

  return (
    <>
      <Card className="mb-3 border-gold/30 bg-gradient-to-br from-leather to-ink text-bone">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rowel className="h-7 w-7 text-gold" />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gold">Your plan</div>
              <div className="font-display text-lg font-bold leading-none">{PLAN_LABEL[plan] ?? "Free"}</div>
            </div>
          </div>
        </div>

        {notice && <div className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-[12px] text-bone/90">{notice}</div>}

        {!enabled ? (
          <div className="mt-3 text-[12px] text-bone/65">Upgrades open soon — you're on the founding list.</div>
        ) : isPaid ? (
          <div className="mt-4">
            {!saveOpen ? (
              <button
                onClick={() => setSaveOpen(true)}
                className="w-full rounded-full bg-bone py-2.5 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-white"
              >
                Manage plan
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] text-bone/70">
                  Before you go — is one of these easier than canceling?
                </div>
                <button
                  onClick={pause}
                  disabled={!!busy}
                  className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-left transition hover:bg-white/15 disabled:opacity-50"
                >
                  <div className="text-sm font-bold text-bone">{busy === "pause" ? "Pausing…" : "Pause for 30 days"}</div>
                  <div className="text-[11px] text-bone/60">Take a breather. No charges while paused; nothing's lost.</div>
                </button>
                <button
                  onClick={downgrade}
                  disabled={!!busy}
                  className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-left transition hover:bg-white/15 disabled:opacity-50"
                >
                  <div className="text-sm font-bold text-bone">{busy === "downgrade" ? "Saving…" : "Switch to Free at renewal"}</div>
                  <div className="text-[11px] text-bone/60">Keep everything you paid for until your renewal date.</div>
                </button>
                <button
                  onClick={manage}
                  disabled={!!busy}
                  className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-left transition hover:bg-white/15 disabled:opacity-50"
                >
                  <div className="text-sm font-bold text-bone">{busy === "portal" ? "Opening…" : "Update card / cancel"}</div>
                  <div className="text-[11px] text-bone/60">Manage payment or cancel in Stripe.</div>
                </button>
                <div className="pt-1 text-center text-[11px] text-bone/55">
                  Stuck on something? Reply to any 8 Seconds email — a real person answers.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["family", "pro"] as const).map((p) => (
              <button
                key={p}
                onClick={() => (user ? startCheckout(p) : ((pendingPlan.current = p), setAuthOpen(true)))}
                disabled={!!busy}
                className={cn(
                  "rounded-2xl px-3 py-3 text-left transition disabled:opacity-50",
                  p === "family" ? "bg-gold text-ink hover:bg-gold/90" : "bg-white/10 text-bone hover:bg-white/15",
                )}
              >
                <div className="font-display text-sm font-bold">{busy === p ? "Starting…" : PLAN_LABEL[p]}</div>
                <div className={cn("text-[11px]", p === "family" ? "text-ink/70" : "text-bone/60")}>{PLAN_PRICE[p]}</div>
              </button>
            ))}
          </div>
        )}
      </Card>
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={() => {
          setAuthOpen(false);
          const p = pendingPlan.current;
          pendingPlan.current = null;
          if (p) startCheckout(p);
        }}
        intent="Create your account to upgrade"
      />
    </>
  );
}

/* Alerts feed + subscription — the core retention hook. */
function AlertsPanel() {
  const { user, alertSub, refresh } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.alerts().then((d) => setAlerts(d.alerts ?? []));
    api.markAlertsRead().catch(() => {});
  }, [user]);

  async function enable() {
    setSaving(true);
    try {
      await api.subscribeAlerts({ email: user?.email, channels: ["email"], lead_days: 7 });
      track("alerts_enabled");
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <>
        <Card className="border-rust/25 bg-rust/[0.04]">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-rust/12 text-xl">🔔</span>
            <div className="flex-1">
              <div className="font-display font-bold text-ink">Never miss a draw</div>
              <div className="text-xs text-ink/55">Get deadline + draw alerts for the events you follow.</div>
            </div>
          </div>
          <button onClick={() => setAuthOpen(true)} className="mt-3 w-full rounded-full bg-rust py-2.5 text-xs font-bold uppercase tracking-wider text-bone">
            Turn on alerts (free)
          </button>
        </Card>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={() => { setAuthOpen(false); enable(); }} intent="Turn on deadline alerts" />
      </>
    );
  }

  if (!alertSub) {
    return (
      <Card className="border-rust/25 bg-rust/[0.04]">
        <div className="font-display font-bold text-ink">Turn on deadline alerts</div>
        <div className="mt-1 text-xs text-ink/55">We'll email you before entries close on events in your watchlist.</div>
        <button onClick={enable} disabled={saving} className="mt-3 w-full rounded-full bg-rust py-2.5 text-xs font-bold uppercase tracking-wider text-bone disabled:opacity-50">
          {saving ? "Saving…" : "Enable alerts"}
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <div className="font-display font-bold text-ink">Your alerts</div>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-sage-deep">
          <span className="h-2 w-2 rounded-full bg-sage" /> On
        </span>
      </div>
      {alerts.length === 0 ? (
        <p className="text-xs text-ink/50">You're all set. We'll alert you here and by email as deadlines approach.</p>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, 6).map((a) => (
            <div key={String(a.id)} className="rounded-xl bg-paper/70 p-2.5">
              <div className="text-[12px] font-semibold text-ink">{String(a.title)}</div>
              <div className="text-[11px] text-ink/55">{String(a.body)}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ================= SPONSOR PEN ================= */
const tierTone = { Bronze: "ink", Silver: "sage", Gold: "gold", Buckle: "rust" } as const;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

// Real, shareable media kit: builds a branded one-pager in a new window and
// opens the print dialog (Save as PDF). No server round-trip needed.
function openMediaKit(kit: { name: string; backNumber: string; disciplines: string[]; state?: string; sponsors: { brand: string; tier: string }[]; annualValue: number }) {
  const w = window.open("", "_blank", "width=860,height=1120");
  if (!w) return;
  const partners = kit.sponsors.map((s) => `<li><strong>${esc(s.brand)}</strong> <span style="color:#8a5a3b">· ${esc(s.tier)} partner</span></li>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(kit.name)} — Media Kit</title>
  <style>
    @page{margin:0.6in}
    *{box-sizing:border-box} body{margin:0;font-family:Georgia,serif;color:#2b1d12;background:#fff;line-height:1.5}
    .wrap{max-width:720px;margin:0 auto;padding:8px}
    .brand{font-family:Arial Narrow,Arial,sans-serif;font-weight:700;letter-spacing:1px;color:#b8502b;font-size:20px}
    .rule{height:3px;width:56px;background:#e0a458;margin:10px 0 20px}
    h1{font-family:Arial Narrow,Arial,sans-serif;font-size:40px;line-height:1;margin:0 0 4px}
    .meta{color:#8a5a3b;font-size:14px;margin-bottom:18px}
    .stats{display:flex;gap:14px;margin:18px 0}
    .stat{flex:1;border:1px solid #e6d3b3;border-radius:12px;padding:12px;text-align:center}
    .stat b{display:block;font-family:Arial Narrow,Arial,sans-serif;font-size:26px}
    .stat span{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8a5a3b}
    h2{font-family:Arial Narrow,Arial,sans-serif;font-size:16px;text-transform:uppercase;letter-spacing:1px;color:#b8502b;margin:22px 0 8px}
    ul{margin:0;padding-left:18px} li{margin:5px 0}
    .tiers{display:flex;gap:10px;margin-top:8px}
    .tier{flex:1;border:1px solid #e6d3b3;border-radius:12px;padding:12px}
    .tier b{font-family:Arial Narrow,Arial,sans-serif}
    .foot{margin-top:26px;border-top:1px solid #d9b98c;padding-top:12px;font-size:12px;color:#8a5a3b}
    @media print{.noprint{display:none}}
  </style></head><body><div class="wrap">
    <div class="brand">8&nbsp;SECONDS</div><div class="rule"></div>
    <h1>${esc(kit.name)}</h1>
    <div class="meta">#${esc(kit.backNumber || "—")} · ${esc(kit.disciplines.join(" · ") || "Rodeo athlete")}${kit.state ? ` · ${esc(kit.state)}` : ""}</div>
    <p>A dedicated youth rodeo competitor building a brand in and out of the arena. Partnering means real visibility with a devoted Western audience — at every rodeo, on every share card, all season long.</p>
    <div class="stats">
      <div class="stat"><b>$${(kit.annualValue / 1000).toFixed(1)}k</b><span>Annual partner value</span></div>
      <div class="stat"><b>${kit.sponsors.length}</b><span>Current partners</span></div>
      <div class="stat"><b>${kit.disciplines.length}</b><span>Events run</span></div>
    </div>
    <h2>Current partners</h2><ul>${partners || "<li>Open for founding partners</li>"}</ul>
    <h2>Partnership tiers</h2>
    <div class="tiers">
      <div class="tier"><b>Buckle</b><br><span style="color:#8a5a3b">Title partner — logo lead, all channels</span></div>
      <div class="tier"><b>Gold</b><br><span style="color:#8a5a3b">Featured — banners + share cards</span></div>
      <div class="tier"><b>Silver</b><br><span style="color:#8a5a3b">Supporting — social + thank-yous</span></div>
    </div>
    <div class="foot">Let's talk — reply to the family that shared this, or reach us at 8s.rodeo. Built with 8 Seconds.</div>
    <p class="noprint" style="text-align:center;margin-top:20px"><button onclick="window.print()" style="background:#b8502b;color:#fff;border:0;border-radius:999px;padding:12px 26px;font-family:Arial Narrow,Arial,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:1px;cursor:pointer">Save as PDF / Print</button></p>
  </div></body></html>`);
  w.document.close();
  w.focus();
}

export function SponsorScreen() {
  const { data } = useDemo();
  if (!data) return null;
  const rylee = data.contestants[0];
  const total = data.sponsors.reduce((s, x) => s + x.annualValue, 0);

  return (
    <div>
      <ScreenHeader eyebrow="The Sponsor Pen" title="Partners" />
      <SampleBanner note="Sample partners — the media kit uses this demo athlete until you add your own." />

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
          {[[`$${(total / 1000).toFixed(1)}k`, "Annual value"], [String(data.sponsors.length), "Partners"], [String(rylee.disciplines.length), "Events"]].map(([n, l]) => (
            <div key={l} className="rounded-xl bg-white/10 py-2">
              <div className="font-display text-lg font-bold">{n}</div>
              <div className="text-[8px] uppercase tracking-widest text-bone/60">{l}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            openMediaKit({
              name: `${rylee.firstName} ${rylee.lastName}`,
              backNumber: String(rylee.backNumber),
              disciplines: rylee.disciplines,
              sponsors: data.sponsors.map((s) => ({ brand: s.brand, tier: s.tier })),
              annualValue: total,
            })
          }
          className="mt-4 w-full rounded-full bg-bone py-2.5 text-xs font-bold uppercase tracking-wider text-ink transition hover:bg-white"
        >
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

interface LiveArena {
  id: string;
  name: string;
  city: string;
  state: string;
  status: string;
  lat: number;
  lng: number;
}

export function GatepostScreen() {
  const { data } = useDemo();
  const { user } = useAuth();
  const [signed, setSigned] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [liveArenas, setLiveArenas] = useState<LiveArena[] | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  // Load the signed-in family's saved signatures so "Add my name" persists.
  useEffect(() => {
    if (!user) {
      setSigned({});
      return;
    }
    api.myPetitions().then((d) => setSigned(Object.fromEntries(d.arenas.map((a) => [a, true]))));
  }, [user]);

  // Persist a signature (or open sign-in for guests).
  function toggleSign(arenaId: string) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    const next = !signed[arenaId];
    setSigned((s) => ({ ...s, [arenaId]: next }));
    track("petition_signed", { arena: arenaId, signed: next });
    api.signPetition(arenaId, next).catch(() => setSigned((s) => ({ ...s, [arenaId]: !next })));
  }

  useEffect(() => {
    let alive = true;
    fetch("/api/arenas")
      .then((r) => (r.ok ? r.json() : { arenas: null }))
      .then((d: { arenas: LiveArena[] | null }) => alive && d.arenas && setLiveArenas(d.arenas))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data) return null;

  const arenaTo = (s: string) =>
    (s === "threatened" ? "rust" : s === "saved" ? "turq" : s === "watch" ? "gold" : "sage") as
      | "rust"
      | "turq"
      | "gold"
      | "sage";

  // Map shows curated demo arenas + any real geocoded ones from Perplexity.
  const mapPins = [
    ...data.arenas.map((a) => ({ id: a.id, lat: a.lat, lng: a.lng, title: a.name, subtitle: `${a.city}, ${a.state}`, tone: arenaTo(a.status) })),
    ...(liveArenas ?? []).map((a) => ({ id: a.id, lat: a.lat, lng: a.lng, title: a.name, subtitle: `${a.city}, ${a.state}`, tone: arenaTo(a.status) })),
  ].map((p) => ({ ...p, active: p.id === selected }));

  return (
    <div>
      <ScreenHeader eyebrow="The Gatepost" title="Stand the ground" />
      <p className="mb-4 font-serif text-sm leading-relaxed text-ink/60">
        Arenas are community anchors. When development or a noise complaint threatens one, families organize here
        — together.
      </p>

      {liveArenas && (
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-turq">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-turq opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-turq" />
          </span>
          Live · {liveArenas.length} arenas in the news
        </div>
      )}

      <LazyRodeoMap
        className="mb-4 h-60 border border-saddle/20"
        selectedId={selected}
        onSelect={(id) => setSelected(id)}
        pins={mapPins}
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
                      onClick={() => toggleSign(a.id)}
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
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={() => setAuthOpen(false)} intent="Add your name to the fight" />
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
  const { user, refresh } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [imported, setImported] = useState("");
  const [authOpen, setAuthOpen] = useState(false);

  async function run() {
    setBusy(true);
    setErr("");
    setResult(null);
    setImported("");
    try {
      const r = await api.importData(text, "pasted-data.csv");
      setResult(r);
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!result) return;
    setConfirming(true);
    setErr("");
    try {
      const r = await api.importConfirm(result.records);
      track("import_confirmed", r.added);
      setImported(`Added ${r.added.contestants} rider${r.added.contestants === 1 ? "" : "s"} and ${r.added.horses} horse${r.added.horses === 1 ? "" : "s"} to your barn.`);
      await refresh();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setConfirming(false);
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
          {imported ? (
            <div className="mt-4 rounded-2xl bg-sage/12 p-4 text-center text-sm font-semibold text-sage-deep">
              ✓ {imported} <Link to="/app/tack" className="underline underline-offset-2">See your barn →</Link>
            </div>
          ) : (
            result.records.length > 0 && (
              <button
                onClick={confirmImport}
                disabled={confirming}
                className="mt-4 w-full rounded-full bg-ink py-3 text-xs font-bold uppercase tracking-wider text-bone transition hover:bg-leather disabled:opacity-50"
              >
                {confirming ? "Importing…" : user ? `Confirm & import to my barn` : "Sign in to import"}
              </button>
            )
          )}
        </div>
      )}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={() => { setAuthOpen(false); confirmImport(); }} intent="Save your imported history" />
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
      <SampleBanner note="Sample budget — a starting point you can make your own." />
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
