import type { Context } from "hono";
import type { Env } from "./index";
import {
  clearCookie,
  createSession,
  currentUserId,
  hashPassword,
  sessionCookie,
  verifyPassword,
} from "./auth";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const now = () => new Date().toISOString();
const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 12)}`;

function requireDB(c: Context<{ Bindings: Env }>): D1Database | null {
  return c.env.DB ?? null;
}

/* ---------------- Auth ---------------- */
export async function signup(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = requireDB(c);
  if (!db) return c.json({ error: "Accounts unavailable" }, 503);
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").slice(0, 120);
  if (!EMAIL_RE.test(email)) return c.json({ error: "Enter a valid email." }, 422);
  if (password.length < 8) return c.json({ error: "Password must be at least 8 characters." }, 422);

  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return c.json({ error: "An account with that email already exists." }, 409);

  const { hash, salt } = await hashPassword(password);
  const id = uid("u");
  await db
    .prepare(
      "INSERT INTO users (id, email, pass_hash, salt, name, role, state, created_at) VALUES (?,?,?,?,?,?,?,?)",
    )
    .bind(id, email, hash, salt, name, String(body.role ?? ""), String(body.state ?? ""), now())
    .run();

  const token = await createSession(c.env, id);
  c.header("Set-Cookie", sessionCookie(token));
  return c.json({ ok: true, user: { id, email, name } });
}

export async function login(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = requireDB(c);
  if (!db) return c.json({ error: "Accounts unavailable" }, 503);
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const row = (await db
    .prepare("SELECT id, pass_hash, salt, name FROM users WHERE email = ?")
    .bind(email)
    .first()) as { id: string; pass_hash: string; salt: string; name: string } | null;
  if (!row || !(await verifyPassword(password, row.salt, row.pass_hash))) {
    return c.json({ error: "Wrong email or password." }, 401);
  }
  const token = await createSession(c.env, row.id);
  c.header("Set-Cookie", sessionCookie(token));
  return c.json({ ok: true, user: { id: row.id, email, name: row.name } });
}

export async function logout(c: Context<{ Bindings: Env }>): Promise<Response> {
  c.header("Set-Cookie", clearCookie());
  return c.json({ ok: true });
}

export async function me(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = requireDB(c);
  const id = await currentUserId(c);
  if (!db || !id) return c.json({ user: null });
  const u = (await db
    .prepare("SELECT id, email, name, role, state, home_lat, home_lng FROM users WHERE id = ?")
    .bind(id)
    .first()) as Record<string, unknown> | null;
  if (!u) return c.json({ user: null });
  const [contestants, horses, watch, sub] = await Promise.all([
    db.prepare("SELECT * FROM contestants_u WHERE user_id = ? ORDER BY created_at").bind(id).all(),
    db.prepare("SELECT * FROM horses_u WHERE user_id = ? ORDER BY created_at").bind(id).all(),
    db.prepare("SELECT event_id, status FROM watchlist WHERE user_id = ?").bind(id).all(),
    db.prepare("SELECT * FROM alert_subs WHERE user_id = ?").bind(id).first(),
  ]);
  return c.json({
    user: u,
    contestants: contestants.results ?? [],
    horses: horses.results ?? [],
    watchlist: watch.results ?? [],
    alertSub: sub ?? null,
  });
}

/* ---------------- Roster CRUD ---------------- */
async function guard(c: Context<{ Bindings: Env }>): Promise<{ db: D1Database; id: string } | Response> {
  const db = requireDB(c);
  const id = await currentUserId(c);
  if (!db) return c.json({ error: "unavailable" }, 503);
  if (!id) return c.json({ error: "Not signed in" }, 401);
  return { db, id };
}

export async function addContestant(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const b = await c.req.json().catch(() => ({}));
  if (!b.first_name) return c.json({ error: "Name required" }, 422);
  const id = uid("c");
  await g.db
    .prepare(
      "INSERT INTO contestants_u (id,user_id,first_name,last_name,birthdate,division,associations,disciplines,back_number,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      id, g.id, String(b.first_name).slice(0, 80), String(b.last_name ?? ""), String(b.birthdate ?? ""),
      String(b.division ?? ""), JSON.stringify(b.associations ?? []), JSON.stringify(b.disciplines ?? []),
      String(b.back_number ?? ""), now(),
    )
    .run();
  return c.json({ ok: true, id });
}

export async function addHorse(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const b = await c.req.json().catch(() => ({}));
  if (!b.name) return c.json({ error: "Name required" }, 422);
  const id = uid("h");
  await g.db
    .prepare(
      "INSERT INTO horses_u (id,user_id,rider_id,name,barn_name,breed,color,role,farrier_due,vet_due,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      id, g.id, String(b.rider_id ?? ""), String(b.name).slice(0, 100), String(b.barn_name ?? ""),
      String(b.breed ?? ""), String(b.color ?? ""), String(b.role ?? ""), String(b.farrier_due ?? ""),
      String(b.vet_due ?? ""), String(b.notes ?? "").slice(0, 500), now(),
    )
    .run();
  return c.json({ ok: true, id });
}

export async function deleteRecord(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const kind = c.req.param("kind");
  const recId = c.req.param("id");
  const table = kind === "contestant" ? "contestants_u" : kind === "horse" ? "horses_u" : null;
  if (!table) return c.json({ error: "bad kind" }, 400);
  await g.db.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).bind(recId, g.id).run();
  return c.json({ ok: true });
}

export async function toggleWatch(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const b = await c.req.json().catch(() => ({}));
  const eventId = String(b.event_id ?? "");
  if (!eventId) return c.json({ error: "event_id required" }, 422);
  const status = b.status === "entered" ? "entered" : "watching";
  const existing = await g.db
    .prepare("SELECT status FROM watchlist WHERE user_id = ? AND event_id = ?")
    .bind(g.id, eventId)
    .first();
  if (existing && !b.force) {
    await g.db.prepare("DELETE FROM watchlist WHERE user_id = ? AND event_id = ?").bind(g.id, eventId).run();
    return c.json({ ok: true, watching: false });
  }
  await g.db
    .prepare("INSERT OR REPLACE INTO watchlist (user_id,event_id,status,created_at) VALUES (?,?,?,?)")
    .bind(g.id, eventId, status, now())
    .run();
  return c.json({ ok: true, watching: true, status });
}

/* ---------------- Alerts ---------------- */
export async function saveAlertSub(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const b = await c.req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  await g.db
    .prepare(
      "INSERT OR REPLACE INTO alert_subs (user_id,email,channels,states,disciplines,lead_days,created_at) VALUES (?,?,?,?,?,?,?)",
    )
    .bind(
      g.id, email, JSON.stringify(b.channels ?? ["email"]), JSON.stringify(b.states ?? []),
      JSON.stringify(b.disciplines ?? []), Number(b.lead_days ?? 7), now(),
    )
    .run();
  return c.json({ ok: true });
}

export async function listAlerts(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await guard(c);
  if (g instanceof Response) return g;
  const { results } = await g.db
    .prepare("SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .bind(g.id)
    .all();
  return c.json({ alerts: results ?? [] });
}

export async function markAlertsRead(c: Context<{ Bindings: Env }>): Promise<Response> {
  const g = await guard(c);
  if (g instanceof Response) return g;
  await g.db.prepare("UPDATE alerts SET read_at = ? WHERE user_id = ? AND read_at IS NULL").bind(now(), g.id).run();
  return c.json({ ok: true });
}

/* ---------------- Supply side ---------------- */
export async function submitEvent(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = requireDB(c);
  if (!db) return c.json({ error: "unavailable" }, 503);
  const b = await c.req.json().catch(() => ({}));
  if (!b.name || !b.city || !b.state) return c.json({ error: "Name, city, and state are required." }, 422);
  const id = uid("sub");
  await db
    .prepare(
      "INSERT INTO event_submissions (id,name,association,disciplines,venue,city,state,start_date,entry_deadline,contact_email,source_url,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      id, String(b.name).slice(0, 200), String(b.association ?? ""), JSON.stringify(b.disciplines ?? []),
      String(b.venue ?? ""), String(b.city), String(b.state).toUpperCase().slice(0, 2),
      String(b.start_date ?? ""), String(b.entry_deadline ?? ""), String(b.contact_email ?? ""),
      String(b.source_url ?? ""), "pending", now(),
    )
    .run();
  return c.json({ ok: true });
}

/* ---------------- Analytics ---------------- */
export async function track(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = requireDB(c);
  if (!db) return c.json({ ok: true }); // never fail the client
  const b = await c.req.json().catch(() => ({}));
  const events: Array<Record<string, unknown>> = Array.isArray(b.events) ? b.events : [b];
  const userId = await currentUserId(c);
  try {
    const stmts = events.slice(0, 20).map((e) =>
      db
        .prepare(
          "INSERT INTO analytics_events (id,ts,session,user_id,name,path,referrer,props) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          uid("ev"), now(), String(e.session ?? "").slice(0, 64), userId, String(e.name ?? "event").slice(0, 80),
          String(e.path ?? "").slice(0, 200), String(e.referrer ?? "").slice(0, 200),
          JSON.stringify(e.props ?? {}).slice(0, 1000),
        ),
    );
    if (stmts.length) await db.batch(stmts);
  } catch {
    /* analytics must never break UX */
  }
  return c.json({ ok: true });
}
