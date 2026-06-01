import type { Context } from "hono";
import type { Env } from "./index";

// Real youth-rodeo event seeding: Perplexity (structured, web-grounded) ->
// Mapbox geocoding -> D1. Token-guarded admin endpoint. The Worker has egress;
// the build sandbox does not, so this runs against the deployed Worker.
//
//   POST /api/admin/seed-events?token=...&state=TX
//   POST /api/admin/seed-arenas?token=...

interface RawEvent {
  name?: string;
  association?: string;
  disciplines?: string[];
  venue?: string;
  city?: string;
  state?: string;
  start_date?: string;
  end_date?: string;
  entry_deadline?: string;
  fee_per_event?: number;
  source_url?: string;
}

interface RawArena {
  name?: string;
  city?: string;
  state?: string;
  status?: string;
  years_active?: number;
  threat?: string;
  story?: string;
  economic_impact?: number;
  source_url?: string;
}

async function perplexity(env: Env, prompt: string): Promise<unknown> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content:
            "You are a data extraction engine. Return ONLY valid minified JSON, no prose, no markdown fences. Use real, current information with source URLs.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 2500,
    }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? "";
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("No JSON array in response");
  return JSON.parse(text.slice(start, end + 1));
}

async function geocode(env: Env, q: string): Promise<[number, number] | null> {
  if (!env.MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      q,
    )}.json?country=US&limit=1&access_token=${env.MAPBOX_TOKEN}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = (await r.json()) as { features?: Array<{ center?: [number, number] }> };
    const c = d.features?.[0]?.center;
    return c ? [c[0], c[1]] : null; // [lng, lat]
  } catch {
    return null;
  }
}

function guard(c: Context<{ Bindings: Env }>): Response | null {
  const token = c.req.query("token");
  if (!c.env.ART_INGEST_TOKEN || token !== c.env.ART_INGEST_TOKEN) {
    return c.json({ error: "forbidden" }, 403);
  }
  if (!c.env.PERPLEXITY_API_KEY) return c.json({ error: "PERPLEXITY_API_KEY not set" }, 400);
  if (!c.env.DB) return c.json({ error: "D1 DB binding required" }, 400);
  return null;
}

export async function seedEvents(c: Context<{ Bindings: Env }>): Promise<Response> {
  const blocked = guard(c);
  if (blocked) return blocked;
  const db = c.env.DB!;
  const state = (c.req.query("state") || "TX").toUpperCase();
  const report: Array<Record<string, unknown>> = [];

  try {
    const prompt = `List up to 12 real upcoming youth rodeo events (NHSRA, NJHRA, NLBRA, AJRA, or state junior rodeo associations) in ${state} for 2026. Return a JSON array; each item: {"name","association","disciplines":["..."],"venue","city","state","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","entry_deadline":"YYYY-MM-DD","fee_per_event":number,"source_url"}. Use real venues and cities. If a field is unknown, use null.`;
    const raw = (await perplexity(c.env, prompt)) as RawEvent[];

    const now = new Date().toISOString();
    for (const e of raw.slice(0, 12)) {
      if (!e?.name || !e?.city) continue;
      const coords = await geocode(c.env, `${e.venue ? e.venue + ", " : ""}${e.city}, ${e.state || state}`);
      const id = "pe_" + crypto.randomUUID().slice(0, 8);
      const lat = coords ? coords[1] : null;
      const lng = coords ? coords[0] : null;
      await db.prepare(
        `INSERT OR REPLACE INTO map_events
         (id,name,association,disciplines,divisions,venue,city,state,start_date,end_date,entry_deadline,fee_per_event,status,lat,lng,source,source_url,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
        .bind(
          id,
          e.name,
          e.association ?? null,
          JSON.stringify(e.disciplines ?? []),
          JSON.stringify(["Pee Wee", "Junior", "Senior"]),
          e.venue ?? null,
          e.city,
          e.state ?? state,
          e.start_date ?? null,
          e.end_date ?? null,
          e.entry_deadline ?? null,
          e.fee_per_event ?? null,
          "open",
          lat,
          lng,
          "perplexity",
          e.source_url ?? null,
          now,
        )
        .run();
      report.push({ name: e.name, city: e.city, geocoded: !!coords });
    }
    return c.json({ ok: true, state, inserted: report.length, events: report });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
}

export async function seedArenas(c: Context<{ Bindings: Env }>): Promise<Response> {
  const blocked = guard(c);
  if (blocked) return blocked;
  const db = c.env.DB!;
  const report: Array<Record<string, unknown>> = [];

  try {
    const prompt = `List up to 10 real US rodeo arenas or fairgrounds that have faced closure, rezoning, development pressure, or noise complaints (or notable ones that were saved by community action). Return a JSON array; each: {"name","city","state","status":"threatened|watch|saved|safe","years_active":number,"threat":"short description","story":"1-2 sentences","economic_impact":number,"source_url"}. Use real places and real news.`;
    const raw = (await perplexity(c.env, prompt)) as RawArena[];

    const now = new Date().toISOString();
    for (const a of raw.slice(0, 10)) {
      if (!a?.name || !a?.city) continue;
      const coords = await geocode(c.env, `${a.name}, ${a.city}, ${a.state || ""}`);
      const id = "pa_" + crypto.randomUUID().slice(0, 8);
      await db.prepare(
        `INSERT OR REPLACE INTO map_arenas
         (id,name,city,state,status,years_active,threat,story,economic_impact,lat,lng,source,source_url,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
        .bind(
          id,
          a.name,
          a.city,
          a.state ?? null,
          a.status ?? "watch",
          a.years_active ?? null,
          a.threat ?? null,
          a.story ?? null,
          a.economic_impact ?? null,
          coords ? coords[1] : null,
          coords ? coords[0] : null,
          "perplexity",
          a.source_url ?? null,
          now,
        )
        .run();
      report.push({ name: a.name, city: a.city, status: a.status, geocoded: !!coords });
    }
    return c.json({ ok: true, inserted: report.length, arenas: report });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
}

// Public read feeds — D1 real data when present, else null so the client uses seed.
export async function listEvents(c: Context<{ Bindings: Env }>): Promise<Response> {
  if (!c.env.DB) return c.json({ events: null });
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM map_events WHERE lat IS NOT NULL ORDER BY start_date LIMIT 200`,
    ).all();
    if (!results || results.length === 0) return c.json({ events: null });
    return c.json({ events: results.map(rowToEvent) });
  } catch {
    return c.json({ events: null });
  }
}

export async function listArenas(c: Context<{ Bindings: Env }>): Promise<Response> {
  if (!c.env.DB) return c.json({ arenas: null });
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM map_arenas WHERE lat IS NOT NULL ORDER BY created_at DESC LIMIT 100`,
    ).all();
    if (!results || results.length === 0) return c.json({ arenas: null });
    return c.json({ arenas: results });
  } catch {
    return c.json({ arenas: null });
  }
}

function rowToEvent(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    association: r.association,
    disciplines: safeArr(r.disciplines),
    divisions: safeArr(r.divisions),
    venue: r.venue,
    city: r.city,
    state: r.state,
    startDate: r.start_date,
    endDate: r.end_date,
    entryDeadline: r.entry_deadline,
    feePerEvent: r.fee_per_event ?? 0,
    status: r.status ?? "open",
    drawPosted: false,
    added: false,
    lat: r.lat,
    lng: r.lng,
    sourceUrl: r.source_url,
  };
}
function safeArr(v: unknown): string[] {
  try {
    return JSON.parse(String(v));
  } catch {
    return [];
  }
}
