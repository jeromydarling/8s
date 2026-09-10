import type { Context } from "hono";
import type { Env } from "./index";
import { currentUserId } from "./auth";
import { clientIp, rateLimit } from "./guard";
import { adminNotifyEmail, notifyAdmins } from "./email";
import { stateCentroid } from "./geo";

// Association site-license + data verification + onboarding.
//
// The model: an association (NHSRA state chapter, a junior rodeo association,
// a local series) is the paying customer. It gets a portal to verify its OWN
// events — which makes it the authoritative data source — and an invite code.
// Any family that joins with the code gets the Family plan bundled at no charge.
// That one mechanic fixes distribution and data trust together.

type C = Context<{ Bindings: Env }>;
const now = () => new Date().toISOString();
const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 12)}`;

// Short, unambiguous invite codes (no 0/O/1/I), prefixed by the abbreviation.
function makeCode(abbr?: string | null): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  const p = String(abbr ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "8S";
  return `${p}-${s}`;
}

async function userGate(c: C): Promise<{ db: D1Database; id: string } | Response> {
  const db = c.env.DB;
  if (!db) return c.json({ error: "unavailable" }, 503);
  const id = await currentUserId(c);
  if (!id) return c.json({ error: "Not signed in" }, 401);
  return { db, id };
}

/* ---------------- Provisioning (Stripe purchase or admin pilot) ---------------- */
export async function provisionAssociation(
  db: D1Database,
  o: {
    name: string;
    abbreviation?: string | null;
    state?: string | null;
    contactEmail?: string | null;
    ownerUserId?: string | null;
    stripeSubscriptionId?: string | null;
    verified?: boolean;
  },
): Promise<{ id: string; invite_code: string }> {
  const id = uid("assoc");
  const code = makeCode(o.abbreviation);
  await db
    .prepare(
      `INSERT INTO associations (id,name,abbreviation,state,contact_email,invite_code,owner_user_id,plan_status,seat_limit,stripe_subscription_id,verified,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      o.name.slice(0, 120),
      o.abbreviation ? String(o.abbreviation).toUpperCase().slice(0, 12) : null,
      o.state ? String(o.state).toUpperCase().slice(0, 2) : null,
      o.contactEmail ?? null,
      code,
      o.ownerUserId ?? null,
      "active",
      200,
      o.stripeSubscriptionId ?? null,
      o.verified ? 1 : 0,
      now(),
    )
    .run();
  if (o.ownerUserId) {
    await db.batch([
      db
        .prepare("INSERT OR IGNORE INTO association_admins (association_id,user_id,role,created_at) VALUES (?,?,?,?)")
        .bind(id, o.ownerUserId, "owner", now()),
      // The owner is the org account — keep their own plan, just attach them.
      db.prepare("UPDATE users SET association_id = ? WHERE id = ?").bind(id, o.ownerUserId),
    ]);
  }
  return { id, invite_code: code };
}

// Attach a family to an association and grant the bundled Family plan. Never
// downgrades a self-paid Pro; a free or already-bundled account becomes Family.
export async function bundleUser(db: D1Database, userId: string, associationId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE users SET
         association_id = ?,
         plan        = CASE WHEN plan = 'pro' AND COALESCE(plan_source,'self') = 'self' THEN plan ELSE 'family' END,
         plan_source = CASE WHEN plan = 'pro' AND COALESCE(plan_source,'self') = 'self' THEN plan_source ELSE 'association' END,
         plan_status = COALESCE(plan_status, 'active'),
         lifecycle   = CASE WHEN lifecycle = 'churned' THEN 'won_back' ELSE lifecycle END
       WHERE id = ?`,
    )
    .bind(associationId, userId)
    .run();
}

/* ---------------- Public ---------------- */
// GET /api/associations — active associations for the onboarding dropdown.
export async function listAssociations(c: C): Promise<Response> {
  if (!c.env.DB) return c.json({ associations: [] });
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, abbreviation, state, verified FROM associations WHERE plan_status = 'active' ORDER BY state, name LIMIT 300",
  ).all();
  return c.json({ associations: results ?? [] });
}

/* ---------------- Family side ---------------- */
// POST /api/association/join { code } — bundled Family plan via invite code.
export async function joinAssociation(c: C): Promise<Response> {
  const g = await userGate(c);
  if (g instanceof Response) return g;
  if (!rateLimit(`join:${clientIp(c)}`, 10, 60_000)) return c.json({ error: "Too many attempts. Try again in a minute." }, 429);
  const b = (await c.req.json().catch(() => ({}))) as { code?: string };
  const result = await joinByCode(g.db, g.id, String(b.code ?? ""));
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json({ ok: true, association: result.association, plan: "family" });
}

async function joinByCode(
  db: D1Database,
  userId: string,
  raw: string,
): Promise<{ association: { id: string; name: string } } | { error: string; status: 404 | 409 | 422 }> {
  const code = raw.trim().toUpperCase();
  if (!code) return { error: "Enter your association's code.", status: 422 };
  const a = (await db
    .prepare("SELECT id, name, seat_limit, plan_status FROM associations WHERE invite_code = ?")
    .bind(code)
    .first()) as { id: string; name: string; seat_limit: number; plan_status: string } | null;
  if (!a || a.plan_status !== "active") return { error: "That code isn't active. Double-check it with your association.", status: 404 };
  const used = (await db.prepare("SELECT COUNT(*) AS n FROM users WHERE association_id = ? AND id != ?").bind(a.id, userId).first()) as
    | { n: number }
    | null;
  if ((used?.n ?? 0) >= a.seat_limit) return { error: "This association's family seats are full — ask them to expand.", status: 409 };
  await bundleUser(db, userId, a.id);
  return { association: { id: a.id, name: a.name } };
}

// GET /api/association/mine — the signed-in user's association + admin flag.
export async function myAssociation(c: C): Promise<Response> {
  const g = await userGate(c);
  if (g instanceof Response) return g;
  const u = (await g.db.prepare("SELECT association_id FROM users WHERE id = ?").bind(g.id).first()) as { association_id: string | null } | null;
  if (!u?.association_id) return c.json({ association: null, isAdmin: false });
  const [a, adm] = await Promise.all([
    g.db.prepare("SELECT id, name, abbreviation, state, verified, plan_status FROM associations WHERE id = ?").bind(u.association_id).first(),
    g.db.prepare("SELECT role FROM association_admins WHERE association_id = ? AND user_id = ?").bind(u.association_id, g.id).first(),
  ]);
  return c.json({ association: a ?? null, isAdmin: !!adm });
}

// POST /api/onboarding { state?, disciplines?, code? } — the post-signup wizard.
export async function saveOnboarding(c: C): Promise<Response> {
  const g = await userGate(c);
  if (g instanceof Response) return g;
  const b = (await c.req.json().catch(() => ({}))) as { state?: string; disciplines?: unknown; code?: string };
  const state = String(b.state ?? "").toUpperCase().slice(0, 2);
  const disciplines = Array.isArray(b.disciplines) ? b.disciplines.map(String).slice(0, 12) : [];
  await g.db
    .prepare("UPDATE users SET state = CASE WHEN ? != '' THEN ? ELSE state END, disciplines = ?, onboarded_at = ? WHERE id = ?")
    .bind(state, state, JSON.stringify(disciplines), now(), g.id)
    .run();
  let joined: { id: string; name: string } | null = null;
  let joinError: string | null = null;
  if (b.code && String(b.code).trim()) {
    const r = await joinByCode(g.db, g.id, String(b.code));
    if ("error" in r) joinError = r.error;
    else joined = r.association;
  }
  return c.json({ ok: true, joined, joinError });
}

/* ---------------- Crowd corrections ---------------- */
const EVENT_FIELDS = new Set(["entry_deadline", "start_date", "end_date", "venue", "city", "state", "name", "fee_per_event", "status", "other"]);
const ARENA_FIELDS = new Set(["name", "city", "state", "status", "other"]);

// POST /api/data/correct { target_type, target_id, field, suggested_value, note }
export async function submitCorrection(c: C): Promise<Response> {
  const g = await userGate(c);
  if (g instanceof Response) return g;
  if (!rateLimit(`correct:${clientIp(c)}`, 10, 60_000)) return c.json({ error: "Slow down a moment and try again." }, 429);
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const targetType = b.target_type === "arena" ? "arena" : "event";
  const targetId = String(b.target_id ?? "").slice(0, 80);
  const field = String(b.field ?? "other").slice(0, 40);
  const value = String(b.suggested_value ?? "").slice(0, 300);
  const note = String(b.note ?? "").slice(0, 600);
  if (!targetId) return c.json({ error: "Missing target." }, 422);
  if (!(targetType === "event" ? EVENT_FIELDS : ARENA_FIELDS).has(field)) return c.json({ error: "Unknown field." }, 422);
  if (!value && !note) return c.json({ error: "Tell us what's wrong or what it should be." }, 422);

  const id = uid("corr");
  await g.db
    .prepare(
      "INSERT INTO data_corrections (id,target_type,target_id,field,suggested_value,note,submitted_by,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .bind(id, targetType, targetId, field, value, note, g.id, "pending", now())
    .run();
  c.executionCtx.waitUntil(
    notifyAdmins(c.env, adminNotifyEmail("data correction", `${targetType} ${targetId}\n${field}: ${value || "—"}\n${note || ""}`)),
  );
  return c.json({ ok: true, id });
}

// Apply an approved correction (admin or owning association). Whitelisted fields only.
export async function applyCorrection(db: D1Database, corrId: string, reviewer: string): Promise<boolean> {
  const r = (await db.prepare("SELECT * FROM data_corrections WHERE id = ? AND status = 'pending'").bind(corrId).first()) as
    | Record<string, string | null>
    | null;
  if (!r) return false;
  const table = r.target_type === "arena" ? "map_arenas" : "map_events";
  const ok = (r.target_type === "arena" ? ARENA_FIELDS : EVENT_FIELDS).has(String(r.field));
  const stmts: D1PreparedStatement[] = [];
  if (ok && r.field !== "other" && r.suggested_value) {
    // Field name is whitelisted above, so interpolating it is safe.
    stmts.push(
      db.prepare(`UPDATE ${table} SET ${r.field} = ?, verified_at = ?, verified_by = ? WHERE id = ?`).bind(r.suggested_value, now(), reviewer, r.target_id),
    );
  } else {
    stmts.push(db.prepare(`UPDATE ${table} SET verified_at = ?, verified_by = ? WHERE id = ?`).bind(now(), reviewer, r.target_id));
  }
  stmts.push(db.prepare("UPDATE data_corrections SET status = 'approved', reviewed_by = ?, reviewed_at = ? WHERE id = ?").bind(reviewer, now(), corrId));
  await db.batch(stmts);
  return true;
}

/* ---------------- Association portal (admins only) ---------------- */
type Portal = { db: D1Database; userId: string; assoc: { id: string; name: string; abbreviation: string | null; state: string | null; invite_code: string; seat_limit: number; verified: number; plan_status: string } };

async function portalGate(c: C): Promise<Portal | Response> {
  const g = await userGate(c);
  if (g instanceof Response) return g;
  const row = (await g.db
    .prepare(
      `SELECT a.id, a.name, a.abbreviation, a.state, a.invite_code, a.seat_limit, a.verified, a.plan_status
         FROM association_admins m JOIN associations a ON a.id = m.association_id
        WHERE m.user_id = ? ORDER BY m.created_at LIMIT 1`,
    )
    .bind(g.id)
    .first()) as Portal["assoc"] | null;
  if (!row) return c.json({ error: "You're not an admin of an association yet." }, 403);
  return { db: g.db, userId: g.id, assoc: row };
}

function eventRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    association: r.association,
    city: r.city,
    state: r.state,
    venue: r.venue,
    start_date: r.start_date,
    end_date: r.end_date,
    entry_deadline: r.entry_deadline,
    fee_per_event: r.fee_per_event,
    status: r.status,
    source: r.source,
    verified_at: r.verified_at,
    verified_by: r.verified_by,
  };
}

// GET /api/association/portal — everything the portal home needs in one call.
export async function portalOverview(c: C): Promise<Response> {
  const p = await portalGate(c);
  if (p instanceof Response) return p;
  const { db, assoc } = p;
  const [families, events, pending] = await Promise.all([
    db
      .prepare(
        `SELECT id, name, email, state, plan, plan_source, last_active_at, created_at FROM users WHERE association_id = ? ORDER BY created_at DESC LIMIT 500`,
      )
      .bind(assoc.id)
      .all(),
    db
      .prepare(
        `SELECT * FROM map_events
          WHERE verified_by = ?1 OR (?2 IS NOT NULL AND association = ?2) OR (?3 IS NOT NULL AND state = ?3 AND verified_at IS NULL)
          ORDER BY start_date LIMIT 300`,
      )
      .bind(assoc.id, assoc.abbreviation, assoc.state)
      .all(),
    db
      .prepare(
        `SELECT d.*, e.name AS target_name FROM data_corrections d LEFT JOIN map_events e ON e.id = d.target_id
          WHERE d.status = 'pending' AND d.target_type = 'event' AND (e.verified_by = ?1 OR (?2 IS NOT NULL AND e.association = ?2))
          ORDER BY d.created_at DESC LIMIT 100`,
      )
      .bind(assoc.id, assoc.abbreviation)
      .all(),
  ]);
  const fam = families.results ?? [];
  return c.json({
    association: assoc,
    seats: { used: fam.length, limit: assoc.seat_limit },
    families: fam,
    events: (events.results ?? []).map((r) => eventRow(r as Record<string, unknown>)),
    corrections: pending.results ?? [],
  });
}

const EDITABLE = ["name", "venue", "city", "state", "start_date", "end_date", "entry_deadline", "fee_per_event", "status"] as const;

// POST /api/association/portal/event/:id — claim + verify (optionally editing fields).
export async function portalVerifyEvent(c: C): Promise<Response> {
  const p = await portalGate(c);
  if (p instanceof Response) return p;
  const id = c.req.param("id");
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const f of EDITABLE) {
    if (b[f] !== undefined && b[f] !== null && String(b[f]).trim() !== "") {
      sets.push(`${f} = ?`);
      vals.push(f === "fee_per_event" ? Number(b[f]) || 0 : String(b[f]).slice(0, 200));
    }
  }
  sets.push("verified_at = ?", "verified_by = ?");
  vals.push(now(), p.assoc.id);
  if (p.assoc.abbreviation) {
    sets.push("association = COALESCE(association, ?)");
    vals.push(p.assoc.abbreviation);
  }
  vals.push(id);
  const r = await p.db.prepare(`UPDATE map_events SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  if (!r.meta.changes) return c.json({ error: "Event not found." }, 404);
  return c.json({ ok: true });
}

// POST /api/association/portal/events — add a verified event directly.
export async function portalCreateEvent(c: C): Promise<Response> {
  const p = await portalGate(c);
  if (p instanceof Response) return p;
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim().slice(0, 200);
  const city = String(b.city ?? "").trim().slice(0, 80);
  const state = String(b.state ?? p.assoc.state ?? "").toUpperCase().slice(0, 2);
  const start = String(b.start_date ?? "").slice(0, 10);
  if (!name || !city || !state || !start) return c.json({ error: "Name, city, state, and start date are required." }, 422);
  const lat = Number(b.lat), lng = Number(b.lng);
  const coords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 ? { lat, lng } : stateCentroid(state);
  const id = uid("ev");
  await p.db
    .prepare(
      `INSERT INTO map_events (id,name,association,disciplines,divisions,venue,city,state,start_date,end_date,entry_deadline,fee_per_event,status,lat,lng,source,source_url,created_at,verified_at,verified_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      name,
      p.assoc.abbreviation ?? p.assoc.name.slice(0, 12),
      JSON.stringify(Array.isArray(b.disciplines) ? b.disciplines.map(String).slice(0, 10) : []),
      JSON.stringify(Array.isArray(b.divisions) ? b.divisions.map(String).slice(0, 6) : []),
      String(b.venue ?? "").slice(0, 120),
      city,
      state,
      start,
      String(b.end_date ?? start).slice(0, 10),
      String(b.entry_deadline ?? "").slice(0, 10) || null,
      Number(b.fee_per_event) || 0,
      "open",
      coords?.lat ?? null,
      coords?.lng ?? null,
      "association",
      null,
      now(),
      now(),
      p.assoc.id,
    )
    .run();
  return c.json({ ok: true, id });
}

// POST /api/association/portal/code — rotate the invite code.
export async function portalRotateCode(c: C): Promise<Response> {
  const p = await portalGate(c);
  if (p instanceof Response) return p;
  const code = makeCode(p.assoc.abbreviation);
  await p.db.prepare("UPDATE associations SET invite_code = ? WHERE id = ?").bind(code, p.assoc.id).run();
  return c.json({ ok: true, invite_code: code });
}

// POST /api/association/portal/remove { user_id } — free a seat.
export async function portalRemoveFamily(c: C): Promise<Response> {
  const p = await portalGate(c);
  if (p instanceof Response) return p;
  const b = (await c.req.json().catch(() => ({}))) as { user_id?: string };
  const uid2 = String(b.user_id ?? "");
  if (!uid2 || uid2 === p.userId) return c.json({ error: "Pick a family to remove." }, 422);
  await p.db
    .prepare(
      `UPDATE users SET association_id = NULL,
         plan = CASE WHEN plan_source = 'association' THEN 'free' ELSE plan END,
         plan_source = CASE WHEN plan_source = 'association' THEN NULL ELSE plan_source END
       WHERE id = ? AND association_id = ?`,
    )
    .bind(uid2, p.assoc.id)
    .run();
  return c.json({ ok: true });
}

// POST /api/association/portal/correction/:id { action } — the association reviews
// corrections on its own events.
export async function portalReviewCorrection(c: C): Promise<Response> {
  const p = await portalGate(c);
  if (p instanceof Response) return p;
  const id = c.req.param("id") ?? "";
  const b = (await c.req.json().catch(() => ({}))) as { action?: string };
  if (b.action === "approve") {
    const ok = await applyCorrection(p.db, id, p.assoc.id);
    return ok ? c.json({ ok: true }) : c.json({ error: "Not found." }, 404);
  }
  await p.db.prepare("UPDATE data_corrections SET status = 'rejected', reviewed_by = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'").bind(p.assoc.id, now(), id).run();
  return c.json({ ok: true });
}
