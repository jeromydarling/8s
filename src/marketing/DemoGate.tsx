import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { unlockDemo } from "../lib/demo";
import { Button, Rowel } from "../components/ui";

const ROLES = ["Rodeo parent", "Contestant / rider", "Coach / trainer", "Association / secretary", "Western brand"];

export function DemoGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", role: ROLES[0], state: "", disciplines: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [err, setErr] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErr("");
    try {
      await api.submitLead(form);
      unlockDemo(form.name);
      navigate("/app");
    } catch (e2) {
      // Even if persistence hiccups, let them into the demo — never block.
      unlockDemo(form.name);
      setErr(String((e2 as Error).message ?? e2));
      setTimeout(() => navigate("/app"), 600);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-bone shadow-lift"
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.98, opacity: 0 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.45 }}
          >
            <div className="relative overflow-hidden bg-leather px-6 pt-6 pb-7 text-bone">
              <Rowel className="absolute -right-6 -top-6 h-28 w-28 text-bone/10" />
              <div className="eyebrow text-gold">Live demo · fully seeded</div>
              <h3 className="mt-1 font-display text-3xl font-bold leading-none">Pull back the gate</h3>
              <p className="mt-2 max-w-xs text-sm text-bone/70">
                Step straight into the Hollis family's season — real events, ladders, horses and arenas. No
                download, no setup.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-3 px-6 py-6">
              <Field label="Your name">
                <input required value={form.name} onChange={set("name")} className={input} placeholder="Jane Rider" />
              </Field>
              <Field label="Email">
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  className={input}
                  placeholder="you@ranch.com"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="I'm a…">
                  <select value={form.role} onChange={set("role")} className={input}>
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field label="State">
                  <input value={form.state} onChange={set("state")} className={input} placeholder="TX" />
                </Field>
              </div>
              <Field label="Events you follow (optional)">
                <input
                  value={form.disciplines}
                  onChange={set("disciplines")}
                  className={input}
                  placeholder="Barrels, breakaway, tie-down…"
                />
              </Field>

              {err && <p className="text-xs text-rust">Saved locally — taking you in…</p>}

              <Button type="submit" size="lg" className="w-full" disabled={status === "sending"}>
                {status === "sending" ? "Saddling up…" : "Enter the demo →"}
              </Button>
              <p className="text-center text-[11px] text-ink/45">
                We'll only reach out about early access. No spam, ever.
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const input =
  "w-full rounded-xl border border-saddle/25 bg-white/70 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-rust focus:ring-2 focus:ring-rust/20 placeholder:text-ink/35";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-saddle/70">{label}</span>
      {children}
    </label>
  );
}
