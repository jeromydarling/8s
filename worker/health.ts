import type { Env } from "./index";

// Customer health = a 0-100 signal of how likely an account is to stick. It
// blends recency, engagement, and billing state. The cron recomputes it nightly
// and flips low-scoring / payment-failing accounts to the `at_risk` lifecycle so
// the CRM can surface them for a human touch.

export interface HealthSignals {
  created_at: string;
  last_active_at: string | null;
  email_verified: number;
  plan: string;
  plan_status: string | null;
  paused_until: string | null;
  kids: number;
  horses: number;
  watches: number;
  subs: number;
}

const DAY = 86400_000;
const daysSince = (iso: string | null | undefined): number =>
  iso ? Math.max(0, (Date.now() - new Date(iso).getTime()) / DAY) : Infinity;

export interface Health {
  score: number;
  atRisk: boolean;
  reasons: string[];
}

// Pure + deterministic so it's easy to reason about and test.
export function computeHealth(s: HealthSignals): Health {
  let score = 50;
  const reasons: string[] = [];

  // Recency — the strongest churn predictor.
  const idle = Math.min(daysSince(s.last_active_at), daysSince(s.created_at));
  if (idle <= 7) score += 30;
  else if (idle <= 21) score += 15;
  else if (idle <= 45) score += 0;
  else if (idle <= 90) {
    score -= 15;
    reasons.push(`Quiet ${Math.round(idle)} days`);
  } else {
    score -= 30;
    reasons.push(`Inactive ${Math.round(idle)} days`);
  }

  // Engagement depth.
  if (s.kids + s.horses > 0) score += 10;
  else reasons.push("No roster yet");
  if (s.watches > 0) score += 10;
  else reasons.push("No events followed");
  if (s.subs > 0) score += 10;
  else reasons.push("Alerts off");
  if (s.email_verified) score += 5;

  // Commitment + billing.
  const paid = s.plan && s.plan !== "free";
  if (paid) score += 10;
  if (s.plan_status === "past_due") {
    score -= 25;
    reasons.push("Payment past due");
  } else if (s.plan_status === "canceled") {
    score -= 40;
    reasons.push("Subscription canceled");
  }
  if (s.paused_until && new Date(s.paused_until) > new Date()) {
    score -= 10;
    reasons.push("Plan paused");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const atRisk = score < 40 || s.plan_status === "past_due" || s.plan_status === "canceled";
  return { score, atRisk, reasons };
}

// Nightly recompute for every account. Small user base → one pass is fine.
export async function runHealthScoring(env: Env): Promise<number> {
  if (!env.DB) return 0;
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.created_at, u.last_active_at, u.email_verified, u.plan, u.plan_status, u.paused_until, u.lifecycle,
       (SELECT COUNT(*) FROM contestants_u c WHERE c.user_id = u.id) AS kids,
       (SELECT COUNT(*) FROM horses_u h WHERE h.user_id = u.id) AS horses,
       (SELECT COUNT(*) FROM watchlist w WHERE w.user_id = u.id) AS watches,
       (SELECT COUNT(*) FROM alert_subs a WHERE a.user_id = u.id) AS subs
     FROM users u`,
  ).all();

  const rows = (results ?? []) as unknown as Array<HealthSignals & { id: string; lifecycle: string; email: string; name: string | null }>;
  const newlyAtRisk: Array<{ email: string; name: string }> = [];
  const updates = rows.map((r) => {
    const h = computeHealth(r);
    // Don't override terminal/manual stages (churned, won_back, lead, trial);
    // only move accounts between active <-> at_risk automatically.
    let lifecycle = r.lifecycle;
    if (r.plan_status === "canceled") lifecycle = "churned";
    else if (lifecycle === "active" && h.atRisk) lifecycle = "at_risk";
    else if (lifecycle === "at_risk" && !h.atRisk) lifecycle = "active";
    // First time an active account slips to at_risk → queue one win-back nudge.
    if (r.lifecycle === "active" && lifecycle === "at_risk" && r.email) {
      newlyAtRisk.push({ email: r.email, name: r.name ?? "" });
    }
    return env.DB!.prepare("UPDATE users SET health_score = ?, lifecycle = ? WHERE id = ?").bind(h.score, lifecycle, r.id);
  });
  if (updates.length) await env.DB.batch(updates);

  if (newlyAtRisk.length) {
    const { sendMail, winBackEmail } = await import("./email");
    for (const u of newlyAtRisk) {
      try {
        await sendMail(env, { ...winBackEmail(u.name), to: u.email });
      } catch (e) {
        console.error("winback", u.email, e);
      }
    }
  }
  return updates.length;
}
