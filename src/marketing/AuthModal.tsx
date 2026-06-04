import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Button, Rowel } from "../components/ui";

const ROLES = ["Rodeo parent", "Contestant / rider", "Coach / trainer", "Association / secretary", "Western brand"];

export function AuthModal({
  open,
  onClose,
  onAuthed,
  intent = "Create your family hub",
}: {
  open: boolean;
  onClose: () => void;
  onAuthed?: () => void;
  intent?: string;
}) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: ROLES[0], state: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      if (mode === "signup") {
        await signup(form.email, form.password, { name: form.name, role: form.role, state: form.state });
      } else {
        await login(form.email, form.password);
      }
      onAuthed?.();
    } catch (e2) {
      setErr(String((e2 as Error).message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/75 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-bone shadow-lift"
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.98, opacity: 0 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
          >
            <div className="relative overflow-hidden bg-leather px-6 pt-6 pb-7 text-bone">
              <Rowel className="absolute -right-6 -top-6 h-28 w-28 text-bone/10" />
              <div className="eyebrow text-gold">{mode === "signup" ? "Free account" : "Welcome back"}</div>
              <h3 className="mt-1 font-display text-3xl font-bold leading-none">{mode === "signup" ? intent : "Sign in"}</h3>
              <p className="mt-2 max-w-xs text-sm text-bone/70">
                {mode === "signup"
                  ? "Save your kids, your horses, and the events you're chasing — and get deadline alerts."
                  : "Pick up right where you left off."}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-3 px-6 py-6">
              {mode === "signup" && (
                <Field label="Your name">
                  <input value={form.name} onChange={set("name")} className={input} placeholder="Jane Rider" />
                </Field>
              )}
              <Field label="Email">
                <input required type="email" value={form.email} onChange={set("email")} className={input} placeholder="you@ranch.com" />
              </Field>
              <Field label="Password">
                <input required type="password" value={form.password} onChange={set("password")} className={input} placeholder="At least 8 characters" minLength={8} />
              </Field>
              {mode === "signup" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="I'm a…">
                    <select value={form.role} onChange={set("role")} className={input}>
                      {ROLES.map((r) => (<option key={r}>{r}</option>))}
                    </select>
                  </Field>
                  <Field label="State">
                    <input value={form.state} onChange={set("state")} className={input} placeholder="TX" />
                  </Field>
                </div>
              )}

              {err && <p className="text-xs font-semibold text-rust">{err}</p>}

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "Saddling up…" : mode === "signup" ? "Create account →" : "Sign in →"}
              </Button>

              <button
                type="button"
                onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(""); }}
                className="w-full text-center text-xs font-semibold text-ink/55 underline-offset-4 hover:underline"
              >
                {mode === "signup" ? "Already have an account? Sign in" : "New here? Create a free account"}
              </button>
              {mode === "login" && (
                <a href="/forgot" className="block text-center text-xs text-ink/40 underline-offset-4 hover:underline">
                  Forgot your password?
                </a>
              )}
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
