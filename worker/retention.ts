import type { Context } from "hono";
import type { Env } from "./index";
import { currentUserId } from "./auth";
import { recapEmail, renewalReminderEmail, sendMail } from "./email";

const PLAN_LABEL: Record<string, string> = { family: "Arena Family", pro: "Arena Pro", associations: "Associations" };

// Retention: make the value visible. "Your Season" surfaces what a family has
// actually gotten from the hub — the antidote to the silent "why am I paying?"
// moment that drives churn. Shown in-app and emailed monthly.

const SITE = "https://8s.rodeo";
const DAY = 86400_000;

export interface Recap {
  memberDays: number;
  kids: number;
  horses: number;
  following: number;
  entries: number;
  alerts: number;
  deadlinesCaught: number;
  plan: string;
}

export async function computeRecap(db: D1Database, userId: string): Promise<Recap | null> {
  const u = (await db.prepare("SELECT created_at, plan FROM users WHERE id = ?").bind(userId).first()) as
    | { created_at: string; plan: string }
    | null;
  if (!u) return null;
  const row = (await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM contestants_u WHERE user_id = ?1) AS kids,
         (SELECT COUNT(*) FROM horses_u WHERE user_id = ?1) AS horses,
         (SELECT COUNT(*) FROM watchlist WHERE user_id = ?1) AS following,
         (SELECT COUNT(*) FROM watchlist WHERE user_id = ?1 AND status = 'entered') AS entries,
         (SELECT COUNT(*) FROM alerts WHERE user_id = ?1) AS alerts,
         (SELECT COUNT(*) FROM alerts WHERE user_id = ?1 AND kind = 'entry-deadline') AS deadlines`,
    )
    .bind(userId)
    .first()) as Record<string, number> | null;

  const memberDays = Math.max(1, Math.round((Date.now() - new Date(u.created_at).getTime()) / DAY));
  return {
    memberDays,
    kids: row?.kids ?? 0,
    horses: row?.horses ?? 0,
    following: row?.following ?? 0,
    entries: row?.entries ?? 0,
    alerts: row?.alerts ?? 0,
    deadlinesCaught: row?.deadlines ?? 0,
    plan: u.plan ?? "free",
  };
}

// GET /api/me/recap — the in-app "Your Season" card.
export async function getRecap(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = c.env.DB;
  const id = await currentUserId(c);
  if (!db || !id) return c.json({ recap: null });
  return c.json({ recap: await computeRecap(db, id) });
}

// Turn a recap into human sentences for the email.
export function recapLines(r: Recap): string[] {
  const lines: string[] = [];
  if (r.kids || r.horses) lines.push(`${r.kids} rider${r.kids === 1 ? "" : "s"} and ${r.horses} horse${r.horses === 1 ? "" : "s"} in your barn`);
  if (r.following) lines.push(`${r.following} event${r.following === 1 ? "" : "s"} followed${r.entries ? `, ${r.entries} entered` : ""}`);
  if (r.deadlinesCaught) lines.push(`${r.deadlinesCaught} entry deadline${r.deadlinesCaught === 1 ? "" : "s"} we flagged before they closed`);
  else if (r.alerts) lines.push(`${r.alerts} alert${r.alerts === 1 ? "" : "s"} sent your way`);
  lines.push(`${r.memberDays} day${r.memberDays === 1 ? "" : "s"} riding with 8 Seconds`);
  return lines;
}

// Daily cron: remind paid accounts whose renewal is within 7 days, once per
// cycle (renewal_reminded_at dedups: only remind if we haven't already reminded
// for this cycle's window).
export async function runRenewalReminders(env: Env): Promise<number> {
  if (!env.DB) return 0;
  const soon = new Date(Date.now() + 7 * DAY).toISOString();
  const nowIso = new Date().toISOString();
  const { results } = await env.DB.prepare(
    `SELECT id, email, name, plan, plan_renews_at FROM users
       WHERE plan != 'free'
         AND plan_status IN ('active','trialing')
         AND plan_renews_at IS NOT NULL
         AND plan_renews_at > ?1 AND plan_renews_at <= ?2
         AND (renewal_reminded_at IS NULL OR renewal_reminded_at < datetime(plan_renews_at, '-14 days'))`,
  )
    .bind(nowIso, soon)
    .all();
  const users = (results ?? []) as unknown as Array<{ id: string; email: string; name: string | null; plan: string; plan_renews_at: string }>;
  let sent = 0;
  for (const u of users) {
    try {
      const label = PLAN_LABEL[u.plan] ?? "your plan";
      await sendMail(env, { ...renewalReminderEmail(u.name ?? "", label, u.plan_renews_at), to: u.email });
      await env.DB.prepare("UPDATE users SET renewal_reminded_at = ? WHERE id = ?").bind(nowIso, u.id).run();
      sent++;
    } catch (e) {
      console.error("renewal reminder", u.id, e);
    }
  }
  return sent;
}

// Monthly cron: email active/engaged accounts their recap. Skips brand-new and
// clearly-idle accounts so it lands as a welcome nudge, not spam.
export async function runMonthlyRecaps(env: Env): Promise<number> {
  if (!env.DB) return 0;
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, u.name FROM users u
       WHERE u.lifecycle IN ('active','at_risk')
         AND (SELECT COUNT(*) FROM watchlist w WHERE w.user_id = u.id) > 0`,
  ).all();
  const users = (results ?? []) as unknown as Array<{ id: string; email: string; name: string | null }>;
  let sent = 0;
  for (const u of users) {
    const recap = await computeRecap(env.DB, u.id);
    if (!recap) continue;
    const lines = recapLines(recap);
    if (lines.length < 2) continue; // nothing worth celebrating yet
    try {
      await sendMail(env, { ...recapEmail(u.name ?? "", lines, `${SITE}/app`), to: u.email });
      sent++;
    } catch (e) {
      console.error("recap email", u.id, e);
    }
  }
  return sent;
}
