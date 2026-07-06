import type { Context } from "hono";
import type { Env } from "./index";
import { currentUserId } from "./auth";
import { brandedEmail, sendMail } from "./email";

// Super-admin CRM API. Every route is gated by `adminGate` — the signed-in
// user's email must be in the ADMIN_EMAILS allowlist (comma-separated Worker
// var). No new password surface; it reuses the existing session auth.

const now = () => new Date().toISOString();
const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 12)}`;

// Monthly-normalized revenue per plan (annual Family spread across 12 months).
const MRR: Record<string, number> = { family: 79 / 12, pro: 19.99, associations: 49 };

type Admin = { db: D1Database; email: string };

async function adminGate(c: Context<{ Bindings: Env }>): Promise<Admin | Response> {
  const db = c.env.DB;
  if (!db) return c.json({ error: "unavailable" }, 503);
  const id = await currentUserId(c);
  if (!id) return c.json({ error: "Not signed in" }, 401);
  const u = (await db.prepare("SELECT email FROM users WHERE id = ?").bind(id).first()) as { email: string } | null;
  const allow = (c.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!u || !allow.includes(u.email.toLowerCase())) return c.json({ error: "forbidden" }, 403);
  return { db, email: u.email };
}

// GET /api/admin/crm/me — lets the SPA decide whether to show /admin.
export async function crmMe(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return c.json({ isAdmin: false });
  return c.json({ isAdmin: true, email: g.email });
}

// GET /api/admin/crm/customers?query=&plan=&lifecycle=&sort=
export async function crmCustomers(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const query = (c.req.query("query") ?? "").trim();
  const plan = (c.req.query("plan") ?? "").trim();
  const lifecycle = (c.req.query("lifecycle") ?? "").trim();
  const sort = c.req.query("sort") ?? "recent";
  const order =
    sort === "active"
      ? "u.last_active_at DESC"
      : sort === "health"
        ? "u.health_score ASC"
        : sort === "name"
          ? "u.name COLLATE NOCASE ASC"
          : "u.created_at DESC";
  const like = `%${query}%`;
  const { results } = await g.db
    .prepare(
      `SELECT u.id, u.email, u.name, u.state, u.plan, u.plan_status, u.lifecycle, u.health_score,
              u.last_active_at, u.created_at,
              (SELECT COUNT(*) FROM contestants_u c WHERE c.user_id = u.id) AS kids,
              (SELECT COUNT(*) FROM horses_u h WHERE h.user_id = u.id) AS horses
         FROM users u
        WHERE (?1 = '' OR u.email LIKE ?2 OR u.name LIKE ?2)
          AND (?3 = '' OR u.plan = ?3)
          AND (?4 = '' OR u.lifecycle = ?4)
        ORDER BY ${order}
        LIMIT 300`,
    )
    .bind(query, like, plan, lifecycle)
    .all();
  return c.json({ customers: results ?? [] });
}

// GET /api/admin/crm/customer/:id — the full human-first profile.
export async function crmCustomer(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const id = c.req.param("id");
  const user = (await g.db
    .prepare(
      `SELECT id, email, name, role, state, home_lat, home_lng, plan, plan_status, plan_renews_at, paused_until,
              lifecycle, health_score, email_verified, last_active_at, created_at, stripe_customer_id
         FROM users WHERE id = ?`,
    )
    .bind(id)
    .first()) as Record<string, unknown> | null;
  if (!user) return c.json({ error: "not found" }, 404);
  user.has_billing = user.stripe_customer_id ? 1 : 0;
  delete user.stripe_customer_id;

  const [contestants, horses, watch, sub, messages, tags, tasks] = await Promise.all([
    g.db.prepare("SELECT * FROM contestants_u WHERE user_id = ? ORDER BY created_at").bind(id).all(),
    g.db.prepare("SELECT * FROM horses_u WHERE user_id = ? ORDER BY created_at").bind(id).all(),
    g.db.prepare("SELECT status, COUNT(*) AS n FROM watchlist WHERE user_id = ? GROUP BY status").bind(id).all(),
    g.db.prepare("SELECT * FROM alert_subs WHERE user_id = ?").bind(id).first(),
    g.db.prepare("SELECT * FROM customer_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").bind(id).all(),
    g.db.prepare("SELECT tag FROM customer_tags WHERE user_id = ? ORDER BY created_at").bind(id).all(),
    g.db.prepare("SELECT * FROM admin_tasks WHERE user_id = ? ORDER BY done_at, due_date").bind(id).all(),
  ]);
  return c.json({
    user,
    contestants: contestants.results ?? [],
    horses: horses.results ?? [],
    watch: watch.results ?? [],
    alertSub: sub ?? null,
    messages: messages.results ?? [],
    tags: (tags.results ?? []).map((t) => (t as { tag: string }).tag),
    tasks: tasks.results ?? [],
  });
}

// POST /api/admin/crm/customer/:id/message  { kind:"email"|"note", subject?, body }
export async function crmMessage(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const id = c.req.param("id");
  const b = (await c.req.json().catch(() => ({}))) as { kind?: string; subject?: string; body?: string };
  const body = String(b.body ?? "").trim();
  if (!body) return c.json({ error: "Write something first." }, 422);
  const u = (await g.db.prepare("SELECT email FROM users WHERE id = ?").bind(id).first()) as { email: string } | null;
  if (!u) return c.json({ error: "not found" }, 404);

  if (b.kind === "email") {
    const subject = String(b.subject ?? "A note from 8 Seconds").slice(0, 200);
    const ok = await sendMail(c.env, { ...brandedEmail(subject, body), to: u.email });
    await g.db
      .prepare(
        "INSERT INTO customer_messages (id,user_id,direction,channel,subject,body,author,created_at) VALUES (?,?,?,?,?,?,?,?)",
      )
      .bind(uid("msg"), id, "out", "email", subject, body, g.email, now())
      .run();
    return c.json({ ok: true, delivered: ok });
  }
  // Private note.
  await g.db
    .prepare(
      "INSERT INTO customer_messages (id,user_id,direction,channel,subject,body,author,created_at) VALUES (?,?,?,?,?,?,?,?)",
    )
    .bind(uid("msg"), id, "note", "note", null, body, g.email, now())
    .run();
  return c.json({ ok: true });
}

// POST /api/admin/crm/customer/:id/tags { tag }  ·  DELETE removes it
export async function crmTag(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const id = c.req.param("id");
  const b = (await c.req.json().catch(() => ({}))) as { tag?: string };
  const tag = String(b.tag ?? "").trim().slice(0, 40);
  if (!tag) return c.json({ error: "empty tag" }, 422);
  if (c.req.method === "DELETE") {
    await g.db.prepare("DELETE FROM customer_tags WHERE user_id = ? AND tag = ?").bind(id, tag).run();
  } else {
    await g.db
      .prepare("INSERT OR IGNORE INTO customer_tags (user_id, tag, created_at) VALUES (?,?,?)")
      .bind(id, tag, now())
      .run();
  }
  return c.json({ ok: true });
}

// POST /api/admin/crm/customer/:id/lifecycle { lifecycle }
const LIFECYCLES = ["lead", "trial", "active", "at_risk", "churned", "won_back"];
export async function crmLifecycle(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const id = c.req.param("id");
  const b = (await c.req.json().catch(() => ({}))) as { lifecycle?: string };
  if (!b.lifecycle || !LIFECYCLES.includes(b.lifecycle)) return c.json({ error: "bad stage" }, 422);
  await g.db.prepare("UPDATE users SET lifecycle = ? WHERE id = ?").bind(b.lifecycle, id).run();
  return c.json({ ok: true });
}

// GET /api/admin/crm/map — everyone we can place on a map.
export async function crmMap(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const { results } = await g.db
    .prepare(
      "SELECT id, name, email, state, home_lat, home_lng, plan, lifecycle, health_score FROM users",
    )
    .all();
  const pins = (results ?? [])
    .map((r) => {
      const u = r as Record<string, unknown>;
      let lat = u.home_lat as number | null;
      let lng = u.home_lng as number | null;
      let approx = false;
      if (lat == null || lng == null) {
        const c2 = STATE_CENTROIDS[String(u.state ?? "").toUpperCase()];
        if (!c2) return null;
        [lng, lat] = c2;
        approx = true;
      }
      return {
        id: u.id,
        name: u.name || u.email,
        lat,
        lng,
        approx,
        plan: u.plan,
        lifecycle: u.lifecycle,
        health: u.health_score,
      };
    })
    .filter(Boolean);
  return c.json({ pins });
}

// GET /api/admin/crm/metrics — the dashboard numbers.
export async function crmMetrics(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const [planRows, lifeRows, stateRows, signupRows] = await Promise.all([
    g.db.prepare("SELECT plan, COUNT(*) AS n FROM users GROUP BY plan").all(),
    g.db.prepare("SELECT lifecycle, COUNT(*) AS n FROM users GROUP BY lifecycle").all(),
    g.db.prepare("SELECT state, COUNT(*) AS n FROM users WHERE state != '' GROUP BY state ORDER BY n DESC LIMIT 8").all(),
    g.db
      .prepare(
        "SELECT substr(created_at,1,7) AS ym, COUNT(*) AS n FROM users GROUP BY ym ORDER BY ym DESC LIMIT 12",
      )
      .all(),
  ]);
  const planMix: Record<string, number> = {};
  for (const r of planRows.results ?? []) planMix[String((r as { plan: string }).plan)] = (r as { n: number }).n;
  const lifecycle: Record<string, number> = {};
  for (const r of lifeRows.results ?? []) lifecycle[String((r as { lifecycle: string }).lifecycle)] = (r as { n: number }).n;

  const totalUsers = Object.values(planMix).reduce((s, n) => s + n, 0);
  const paying = Object.entries(planMix)
    .filter(([p]) => p !== "free")
    .reduce((s, [, n]) => s + n, 0);
  const mrr = Object.entries(planMix).reduce((s, [p, n]) => s + (MRR[p] ?? 0) * n, 0);
  const churned = lifecycle.churned ?? 0;
  const churnRate = paying + churned > 0 ? churned / (paying + churned) : 0;

  return c.json({
    totalUsers,
    paying,
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12),
    churnRate: Math.round(churnRate * 1000) / 10, // percent, 1dp
    planMix,
    lifecycle,
    topStates: (stateRows.results ?? []).map((r) => ({ state: (r as { state: string }).state, n: (r as { n: number }).n })),
    signups: (signupRows.results ?? []).map((r) => ({ ym: (r as { ym: string }).ym, n: (r as { n: number }).n })).reverse(),
  });
}

// GET /api/admin/crm/at-risk — the churn radar.
export async function crmAtRisk(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const { results } = await g.db
    .prepare(
      `SELECT id, name, email, state, plan, plan_status, plan_renews_at, lifecycle, health_score, last_active_at
         FROM users
        WHERE lifecycle = 'at_risk' OR plan_status IN ('past_due','canceling','paused')
           OR (health_score IS NOT NULL AND health_score < 40)
        ORDER BY health_score ASC, last_active_at ASC
        LIMIT 100`,
    )
    .all();
  return c.json({ customers: results ?? [] });
}

// GET /api/admin/crm/tasks  ·  POST create  ·  PATCH /task/:id toggle done
export async function crmTasks(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const { results } = await g.db
    .prepare(
      `SELECT t.*, u.name AS customer_name, u.email AS customer_email
         FROM admin_tasks t LEFT JOIN users u ON u.id = t.user_id
        ORDER BY (t.done_at IS NOT NULL), t.due_date IS NULL, t.due_date, t.created_at`,
    )
    .all();
  return c.json({ tasks: results ?? [] });
}

export async function crmCreateTask(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const b = (await c.req.json().catch(() => ({}))) as { title?: string; user_id?: string; due_date?: string };
  const title = String(b.title ?? "").trim().slice(0, 200);
  if (!title) return c.json({ error: "Task needs a title." }, 422);
  const id = uid("task");
  await g.db
    .prepare("INSERT INTO admin_tasks (id,user_id,title,due_date,author,created_at) VALUES (?,?,?,?,?,?)")
    .bind(id, b.user_id || null, title, b.due_date || null, g.email, now())
    .run();
  return c.json({ ok: true, id });
}

export async function crmToggleTask(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const id = c.req.param("id");
  const row = (await g.db.prepare("SELECT done_at FROM admin_tasks WHERE id = ?").bind(id).first()) as
    | { done_at: string | null }
    | null;
  if (!row) return c.json({ error: "not found" }, 404);
  await g.db.prepare("UPDATE admin_tasks SET done_at = ? WHERE id = ?").bind(row.done_at ? null : now(), id).run();
  return c.json({ ok: true });
}

// GET /api/admin/crm/leads — lead inbox  ·  PATCH /lead/:id sets stage
export async function crmLeads(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const { results } = await g.db
    .prepare("SELECT id, name, email, role, org, state, disciplines, stage, created_at FROM leads ORDER BY created_at DESC LIMIT 200")
    .all();
  return c.json({ leads: results ?? [] });
}

const LEAD_STAGES = ["new", "contacted", "qualified", "converted", "archived"];
export async function crmLeadStage(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await adminGate(c);
  if (g instanceof Response) return g;
  const id = c.req.param("id");
  const b = (await c.req.json().catch(() => ({}))) as { stage?: string };
  if (!b.stage || !LEAD_STAGES.includes(b.stage)) return c.json({ error: "bad stage" }, 422);
  await g.db.prepare("UPDATE leads SET stage = ? WHERE id = ?").bind(b.stage, id).run();
  return c.json({ ok: true });
}

// [lng, lat] centroids for the map fallback when a user has no home coords.
const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [-86.79, 32.81], AK: [-152.4, 64.2], AZ: [-111.66, 34.17], AR: [-92.44, 34.75],
  CA: [-119.68, 36.12], CO: [-105.31, 39.06], CT: [-72.76, 41.6], DE: [-75.51, 39.32],
  FL: [-81.69, 27.77], GA: [-83.64, 33.04], HI: [-157.5, 21.09], ID: [-114.48, 44.24],
  IL: [-88.99, 40.35], IN: [-86.26, 39.85], IA: [-93.21, 42.01], KS: [-96.73, 38.53],
  KY: [-84.67, 37.67], LA: [-91.87, 31.17], ME: [-69.38, 44.69], MD: [-76.8, 39.06],
  MA: [-71.53, 42.23], MI: [-84.54, 43.33], MN: [-93.9, 45.69], MS: [-89.68, 32.74],
  MO: [-92.29, 38.46], MT: [-110.45, 46.92], NE: [-98.27, 41.13], NV: [-117.06, 38.31],
  NH: [-71.56, 43.45], NJ: [-74.52, 40.3], NM: [-106.25, 34.84], NY: [-74.95, 42.17],
  NC: [-79.81, 35.63], ND: [-99.78, 47.53], OH: [-82.76, 40.39], OK: [-96.93, 35.57],
  OR: [-122.07, 44.57], PA: [-77.21, 40.59], RI: [-71.51, 41.68], SC: [-80.95, 33.86],
  SD: [-99.44, 44.3], TN: [-86.69, 35.75], TX: [-97.56, 31.05], UT: [-111.86, 40.15],
  VT: [-72.71, 44.05], VA: [-78.17, 37.77], WA: [-121.49, 47.4], WV: [-80.95, 38.49],
  WI: [-89.62, 44.27], WY: [-107.3, 42.99],
};
