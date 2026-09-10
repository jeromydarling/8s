import { useEffect, useState } from "react";
import type { ImportResult } from "@shared/types";
import { useAuth } from "../lib/auth";
import { api, type AssociationLite } from "../lib/api";
import { track } from "../lib/track";
import { cn, Rowel } from "../components/ui";

// Post-signup wizard. Two short steps, both skippable, with AI doing the
// tedious part invisibly: describe your riders and horses in a sentence and
// the same parser behind Import turns it into a real roster — so a brand-new
// account is never an empty room.

const DISCIPLINES = [
  "Barrel Racing", "Breakaway Roping", "Pole Bending", "Goat Tying", "Tie-Down Roping",
  "Team Roping", "Steer Wrestling", "Bull Riding", "Bareback", "Saddle Bronc",
];
const SKIP_KEY = "8s_onboard_skip";

export function OnboardingWizard() {
  const { user, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [state, setState] = useState("");
  const [disc, setDisc] = useState<string[]>([]);
  const [assocs, setAssocs] = useState<AssociationLite[]>([]);
  const [assocId, setAssocId] = useState("");
  const [code, setCode] = useState(() => (new URLSearchParams(window.location.search).get("join") ?? "").toUpperCase());
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ joined?: string | null; joinError?: string | null; added?: { contestants: number; horses: number } }>({});

  useEffect(() => {
    if (!user || user.onboarded_at) {
      setOpen(false);
      return;
    }
    let skipped = false;
    try {
      skipped = localStorage.getItem(SKIP_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (skipped) return;
    setOpen(true);
    setState((user.state ?? "").toUpperCase());
    api.associations().then((d) => setAssocs(d.associations));
    track("onboarding_open");
  }, [user?.id, user?.onboarded_at]);

  if (!open || !user) return null;

  async function finish(skip = false) {
    setBusy(true);
    setErr("");
    try {
      const r = await api.onboarding(skip ? {} : { state, disciplines: disc, code: code.trim() || undefined });
      setResult((x) => ({ ...x, joined: r.joined?.name ?? null, joinError: r.joinError }));
      track(skip ? "onboarding_skipped" : "onboarding_done", { disciplines: disc.length, joined: !!r.joined });
      if (skip) {
        try {
          localStorage.setItem(SKIP_KEY, "1");
        } catch {
          /* ignore */
        }
        await refresh();
        setOpen(false);
        return;
      }
      setStep(3);
      await refresh();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function parse() {
    if (!text.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api.importData(text, "onboarding.txt");
      setParsed(r);
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRoster() {
    if (!parsed) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api.importConfirm(parsed.records);
      setResult((x) => ({ ...x, added: r.added }));
      track("onboarding_roster_added", r.added);
      await finish();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
      setBusy(false);
    }
  }

  const chip = "rounded-full border px-3 py-1.5 text-xs font-semibold transition";
  const input = "w-full rounded-xl border border-saddle/25 bg-white/70 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-rust";

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-bone shadow-lift">
        <div className="relative overflow-hidden bg-leather px-6 pb-6 pt-5 text-bone">
          <Rowel className="absolute -right-6 -top-6 h-28 w-28 text-bone/10" />
          <div className="flex items-center justify-between">
            <div className="eyebrow text-gold">Step {Math.min(step, 2)} of 2</div>
            {step < 3 && (
              <button onClick={() => finish(true)} className="text-[11px] font-semibold text-bone/60 hover:text-bone">Skip for now</button>
            )}
          </div>
          <h3 className="mt-1 font-display text-2xl font-bold leading-none">
            {step === 1 ? "Where do you ride?" : step === 2 ? "Who's in the barn?" : "You're set up."}
          </h3>
          <p className="mt-2 text-sm text-bone/70">
            {step === 1
              ? "Two quick answers and the Draw fills with your rodeos."
              : step === 2
                ? "Say it like you'd tell a neighbor. We'll do the typing."
                : "Deadlines, ladders, and the barn — all yours now."}
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          {step === 1 && (
            <>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-saddle/70">Home state</span>
                <input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="TX" maxLength={2} className={cn(input, "uppercase")} />
              </label>
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-saddle/70">Events you run</span>
                <div className="flex flex-wrap gap-1.5">
                  {DISCIPLINES.map((d) => {
                    const on = disc.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDisc((x) => (on ? x.filter((y) => y !== d) : [...x, d]))}
                        className={cn(chip, on ? "border-rust bg-rust text-bone" : "border-saddle/25 bg-white/60 text-ink/70 hover:border-rust/50")}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-saddle/70">Association (optional)</span>
                <select value={assocId} onChange={(e) => setAssocId(e.target.value)} className={input}>
                  <option value="">Not sure / none yet</option>
                  {assocs.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.state ? ` · ${a.state}` : ""}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-saddle/70">Association code (if you have one)</span>
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="THSRA-AB12CD — unlocks the Family plan" className={cn(input, "uppercase placeholder:normal-case")} />
              </label>
              {err && <p className="text-xs font-semibold text-rust">{err}</p>}
              <button onClick={() => setStep(2)} className="w-full rounded-full bg-rust py-3 text-xs font-bold uppercase tracking-wider text-bone">
                Next →
              </button>
            </>
          )}

          {step === 2 && !parsed && (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={"Two girls: Emma, 12, barrels and breakaway on Dolly. Cade, 15, tie-down on Chex. We also have a young horse named Peanut."}
                className={cn(input, "resize-none")}
              />
              <p className="text-[11px] text-ink/45">Riders and horses get added to your Tack Room. Nothing else is stored.</p>
              {err && <p className="text-xs font-semibold text-rust">{err}</p>}
              <button onClick={parse} disabled={busy || !text.trim()} className="w-full rounded-full bg-rust py-3 text-xs font-bold uppercase tracking-wider text-bone disabled:opacity-50">
                {busy ? "Reading…" : "Set up my barn →"}
              </button>
              <button onClick={() => finish()} disabled={busy} className="w-full text-center text-xs font-semibold text-ink/50 underline-offset-4 hover:underline">
                I'll add them later
              </button>
            </>
          )}

          {step === 2 && parsed && (
            <>
              <div className="rounded-2xl bg-paper/70 p-3">
                <div className="text-[11px] uppercase tracking-widest text-saddle/70">Here's what we found</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                  {[["Riders", parsed.detected.contestants], ["Horses", parsed.detected.horses]].map(([l, n]) => (
                    <div key={String(l)} className="rounded-xl bg-bone py-2">
                      <div className="font-display text-2xl font-bold text-ink">{n as number}</div>
                      <div className="text-[9px] uppercase tracking-wide text-ink/45">{l as string}</div>
                    </div>
                  ))}
                </div>
                <ul className="mt-2 space-y-1 text-[12px] text-ink/70">
                  {parsed.records.slice(0, 6).map((r, i) => (
                    <li key={i} className="truncate">
                      • {Object.entries(r).filter(([k]) => k !== "type").map(([, v]) => v).filter(Boolean).join(" · ")}
                    </li>
                  ))}
                </ul>
              </div>
              {err && <p className="text-xs font-semibold text-rust">{err}</p>}
              <button onClick={confirmRoster} disabled={busy} className="w-full rounded-full bg-rust py-3 text-xs font-bold uppercase tracking-wider text-bone disabled:opacity-50">
                {busy ? "Saving…" : "Looks right — add them"}
              </button>
              <button onClick={() => setParsed(null)} disabled={busy} className="w-full text-center text-xs font-semibold text-ink/50 underline-offset-4 hover:underline">
                Let me reword that
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <ul className="space-y-2 text-sm text-ink/75">
                {result.added && (result.added.contestants + result.added.horses > 0) && (
                  <li>🐴 Added {result.added.contestants} rider{result.added.contestants === 1 ? "" : "s"} and {result.added.horses} horse{result.added.horses === 1 ? "" : "s"} to your Tack Room.</li>
                )}
                {result.joined && <li>🏛️ Welcome — <strong>{result.joined}</strong> covers your Family plan.</li>}
                {result.joinError && <li className="text-rust">Code didn't work: {result.joinError} You can try again under More.</li>}
                {state && <li>📍 The Draw is set to {state}{disc.length ? ` · ${disc.slice(0, 3).join(", ")}${disc.length > 3 ? "…" : ""}` : ""}.</li>}
                <li>🔔 Turn on deadline alerts under More so nothing closes on you.</li>
              </ul>
              <button onClick={() => setOpen(false)} className="w-full rounded-full bg-rust py-3 text-xs font-bold uppercase tracking-wider text-bone">
                Open the Draw →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
