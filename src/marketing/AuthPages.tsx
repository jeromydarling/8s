import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Grain, Rowel, Wordmark } from "../components/ui";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bone">
      <header className="border-b border-saddle/12 px-5 py-4"><Wordmark /></header>
      <div className="mx-auto max-w-md px-5 py-16">
        <div className="relative overflow-hidden rounded-3xl border border-saddle/15 bg-white/50 p-8 text-center">
          <Grain />
          {children}
        </div>
        <Link to="/" className="mt-5 block text-center text-xs font-semibold uppercase tracking-widest text-ink/40">← 8s.rodeo</Link>
      </div>
    </div>
  );
}

const input = "w-full rounded-xl border border-saddle/25 bg-white/70 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-rust focus:ring-2 focus:ring-rust/20";

/* /verify?token=… */
export function VerifyPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  useEffect(() => {
    const token = params.get("token");
    if (!token) { setState("error"); return; }
    fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => setState(r.ok ? "ok" : "error"))
      .catch(() => setState("error"));
  }, [params]);

  return (
    <Frame>
      <Rowel className={`mx-auto h-10 w-10 ${state === "working" ? "animate-spin text-rust [animation-duration:1.4s]" : state === "ok" ? "text-sage-deep" : "text-rust"}`} />
      {state === "working" && <p className="mt-4 font-display text-xl font-bold text-ink">Confirming your email…</p>}
      {state === "ok" && (
        <>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">You're verified.</h1>
          <p className="mt-2 text-sm text-ink/60">Alerts are on. Welcome to the hub.</p>
          <Button size="lg" className="mt-5 w-full" onClick={() => (window.location.href = "/app")}>Open the app →</Button>
        </>
      )}
      {state === "error" && (
        <>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">That link didn't work.</h1>
          <p className="mt-2 text-sm text-ink/60">It may have expired or already been used. Sign in and resend it from your account.</p>
          <Button size="lg" className="mt-5 w-full" onClick={() => (window.location.href = "/app")}>Go to the app</Button>
        </>
      )}
    </Frame>
  );
}

/* /reset?token=… */
export function ResetPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error ?? "Reset failed");
      setDone(true);
      setTimeout(() => navigate("/app"), 1200);
    } catch (e2) {
      setErr(String((e2 as Error).message ?? e2));
    } finally {
      setBusy(false);
    }
  }

  if (!token) return <Frame><h1 className="font-display text-2xl font-bold text-ink">Missing reset link</h1><p className="mt-2 text-sm text-ink/60">Request a new one from the sign-in screen.</p></Frame>;

  return (
    <Frame>
      <Rowel className="mx-auto h-10 w-10 text-rust" />
      {done ? (
        <>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">Password reset.</h1>
          <p className="mt-2 text-sm text-ink/60">Signing you in…</p>
        </>
      ) : (
        <form onSubmit={submit} className="mt-4">
          <h1 className="font-display text-2xl font-bold text-ink">Set a new password</h1>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={`${input} mt-4`} />
          {err && <p className="mt-2 text-xs font-semibold text-rust">{err}</p>}
          <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy}>{busy ? "Saving…" : "Reset password →"}</Button>
        </form>
      )}
    </Frame>
  );
}

/* Standalone forgot-password page at /forgot */
export function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/auth/request-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => {});
    setSent(true); setBusy(false);
  }
  return (
    <Frame>
      <Rowel className="mx-auto h-10 w-10 text-rust" />
      {sent ? (
        <>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">Check your email.</h1>
          <p className="mt-2 text-sm text-ink/60">If an account exists for {email}, we just sent a reset link. It expires in an hour.</p>
        </>
      ) : (
        <form onSubmit={submit} className="mt-4">
          <h1 className="font-display text-2xl font-bold text-ink">Forgot password</h1>
          <p className="mt-1 text-sm text-ink/60">We'll email you a reset link.</p>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@ranch.com" className={`${input} mt-4`} />
          <Button type="submit" size="lg" className="mt-4 w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link →"}</Button>
        </form>
      )}
    </Frame>
  );
}
