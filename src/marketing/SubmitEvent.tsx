import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { track } from "../lib/track";
import { Button, Grain, Rowel, Wordmark } from "../components/ui";

const DISCIPLINES = ["Barrel Racing", "Breakaway Roping", "Tie-Down Roping", "Team Roping", "Goat Tying", "Pole Bending", "Bull Riding", "Saddle Bronc"];

export default function SubmitEvent() {
  const [form, setForm] = useState({
    name: "", association: "", venue: "", city: "", state: "", start_date: "", entry_deadline: "", contact_email: "", source_url: "",
  });
  const [disc, setDisc] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api.submitEvent({ ...form, disciplines: disc });
      track("event_submitted", { state: form.state });
      setDone(true);
    } catch (e2) {
      setErr(String((e2 as Error).message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-bone">
      <header className="border-b border-saddle/12 px-5 py-4">
        <Wordmark />
      </header>
      <div className="mx-auto max-w-xl px-5 py-12">
        <div className="relative overflow-hidden rounded-3xl bg-leather px-6 pt-6 pb-7 text-bone">
          <Rowel className="absolute -right-6 -top-6 h-28 w-28 text-bone/10" />
          <div className="eyebrow text-gold">For associations & secretaries</div>
          <h1 className="mt-1 font-display text-3xl font-bold leading-none">List your rodeo, free.</h1>
          <p className="mt-2 max-w-sm text-sm text-bone/70">
            Add it once. Families across the region discover it, set deadline reminders, and arrive entered.
          </p>
        </div>

        {done ? (
          <div className="relative mt-6 overflow-hidden rounded-3xl border border-sage/30 bg-sage/10 p-8 text-center">
            <Grain />
            <Rowel className="mx-auto h-10 w-10 text-sage-deep" />
            <h2 className="mt-3 font-display text-2xl font-bold text-ink">Got it — thank you.</h2>
            <p className="mt-2 text-sm text-ink/65">
              We'll verify the details and add it to the map. Want to list a whole season?{" "}
              <a href="mailto:hello@8s.rodeo" className="font-semibold text-rust underline-offset-4 hover:underline">Email us</a> and we'll bulk-import it.
            </p>
            <Link to="/" className="mt-5 inline-block text-xs font-semibold uppercase tracking-widest text-ink/40">← Back home</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3 rounded-3xl border border-saddle/15 bg-white/50 p-6">
            <Field label="Rodeo / event name *"><input required value={form.name} onChange={set("name")} className={input} placeholder="Cross Timbers Youth Rodeo" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Association"><input value={form.association} onChange={set("association")} className={input} placeholder="NLBRA" /></Field>
              <Field label="Venue"><input value={form.venue} onChange={set("venue")} className={input} placeholder="Erath County Arena" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City *"><input required value={form.city} onChange={set("city")} className={input} placeholder="Stephenville" /></Field>
              <Field label="State *"><input required value={form.state} onChange={set("state")} className={input} placeholder="TX" maxLength={2} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date"><input type="date" value={form.start_date} onChange={set("start_date")} className={input} /></Field>
              <Field label="Entry deadline"><input type="date" value={form.entry_deadline} onChange={set("entry_deadline")} className={input} /></Field>
            </div>
            <div>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-saddle/70">Disciplines</span>
              <div className="flex flex-wrap gap-1.5">
                {DISCIPLINES.map((d) => {
                  const on = disc.includes(d);
                  return (
                    <button type="button" key={d} onClick={() => setDisc((s) => on ? s.filter((x) => x !== d) : [...s, d])}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${on ? "bg-rust text-bone" : "bg-ink/6 text-ink/60"}`}>
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your email"><input type="email" value={form.contact_email} onChange={set("contact_email")} className={input} placeholder="secretary@…" /></Field>
              <Field label="Info / entry link"><input value={form.source_url} onChange={set("source_url")} className={input} placeholder="https://…" /></Field>
            </div>
            {err && <p className="text-xs font-semibold text-rust">{err}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Sending…" : "Submit event →"}</Button>
            <Link to="/" className="block text-center text-xs font-semibold uppercase tracking-widest text-ink/40">← Back home</Link>
          </form>
        )}
      </div>
    </div>
  );
}

const input = "w-full rounded-xl border border-saddle/25 bg-white/70 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-rust focus:ring-2 focus:ring-rust/20 placeholder:text-ink/35";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-saddle/70">{label}</span>{children}</label>;
}
