import type { Env } from "./index";

// Compute deadline alerts: for each alert subscription, find events whose entry
// deadline is within lead_days and create an alert row (idempotent per user+event
// +kind). Email send is stubbed until a provider is configured — alerts still
// appear in the in-app feed regardless.

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 12)}`;

interface EventRow {
  id: string;
  name: string;
  city: string;
  state: string;
  entry_deadline: string | null;
  disciplines: string | null;
}

export async function runAlerts(env: Env): Promise<{ created: number; sent: number }> {
  if (!env.DB) return { created: 0, sent: 0 };
  const db = env.DB;
  let created = 0;
  let sent = 0;

  const subs = await db.prepare("SELECT * FROM alert_subs").all();
  const events = (await db
    .prepare("SELECT id,name,city,state,entry_deadline,disciplines FROM map_events WHERE entry_deadline IS NOT NULL")
    .all()) as { results: EventRow[] };

  const today = new Date();

  for (const sub of subs.results ?? []) {
    const userId = String((sub as Record<string, unknown>).user_id);
    const leadDays = Number((sub as Record<string, unknown>).lead_days ?? 7);
    const states = safeArr((sub as Record<string, unknown>).states);
    const disciplines = safeArr((sub as Record<string, unknown>).disciplines);

    // Only email verified users (free plan must confirm; paid skips).
    const u = (await db
      .prepare("SELECT email_verified, plan FROM users WHERE id = ?")
      .bind(userId)
      .first()) as { email_verified: number; plan: string } | null;
    const canEmail = !!u && (u.email_verified === 1 || (u.plan ?? "free") !== "free");

    // Events the user is watching are always in scope.
    const watch = await db.prepare("SELECT event_id FROM watchlist WHERE user_id = ?").bind(userId).all();
    const watched = new Set((watch.results ?? []).map((r) => String((r as Record<string, unknown>).event_id)));

    for (const e of events.results ?? []) {
      if (!e.entry_deadline) continue;
      const inScope =
        watched.has(e.id) ||
        (states.length === 0 || states.includes(e.state)) &&
          (disciplines.length === 0 || safeArr(e.disciplines).some((d) => disciplines.includes(d)));
      if (!inScope) continue;

      const due = new Date(e.entry_deadline + "T00:00:00Z");
      const days = Math.round((due.getTime() - today.getTime()) / 86400000);
      if (days < 0 || days > leadDays) continue;

      // Idempotent: skip if we already alerted this user for this event deadline.
      const existing = await db
        .prepare("SELECT id FROM alerts WHERE user_id = ? AND event_id = ? AND kind = 'entry-deadline'")
        .bind(userId, e.id)
        .first();
      if (existing) continue;

      const id = uid("al");
      const title = `Entry closing: ${e.name}`;
      const body = `Entries for ${e.name} in ${e.city}, ${e.state} close ${e.entry_deadline} (${days} day${days === 1 ? "" : "s"}).`;
      await db
        .prepare(
          "INSERT INTO alerts (id,user_id,event_id,kind,title,body,due_date,created_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(id, userId, e.id, "entry-deadline", title, body, e.entry_deadline, now())
        .run();
      created++;

      const email = String((sub as Record<string, unknown>).email ?? "");
      if (canEmail && email && (await sendEmail(env, email, title, body))) {
        await db.prepare("UPDATE alerts SET sent_at = ? WHERE id = ?").bind(now(), id).run();
        sent++;
      }
    }
  }
  return { created, sent };
}

// Email delivery. Uses Resend if RESEND_API_KEY is set; otherwise logs and
// returns false (alert still shows in-app). Swap provider here only.
async function sendEmail(env: Env, to: string, subject: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log(`[alert:would-email] ${to} :: ${subject}`);
    return false;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "8 Seconds <alerts@8s.rodeo>",
        to,
        subject,
        text: `${text}\n\n— 8 Seconds · 8s.rodeo`,
      }),
    });
    return r.ok;
  } catch (e) {
    console.error("email send failed", e);
    return false;
  }
}

function safeArr(v: unknown): string[] {
  try {
    const a = JSON.parse(String(v ?? "[]"));
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
}
