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
  lat?: number;
  lng?: number;
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
  lat?: number;
  lng?: number;
  source_url?: string;
}

// US/Canada state & province centroids — last-resort so a pin always lands.
const STATE_CENTROID: Record<string, [number, number]> = {
  AL: [-86.79, 32.81], AK: [-152.0, 64.0], AZ: [-111.66, 34.17], AR: [-92.44, 34.97],
  CA: [-119.68, 36.12], CO: [-105.31, 39.06], CT: [-72.76, 41.6], DE: [-75.51, 39.32],
  FL: [-81.69, 27.77], GA: [-83.64, 33.04], HI: [-157.5, 21.09], ID: [-114.48, 44.24],
  IL: [-88.99, 40.35], IN: [-86.26, 39.85], IA: [-93.21, 42.01], KS: [-96.73, 38.53],
  KY: [-84.67, 37.67], LA: [-91.87, 31.17], ME: [-69.38, 44.69], MD: [-76.8, 39.06],
  MA: [-71.53, 42.23], MI: [-84.54, 43.33], MN: [-93.9, 45.69], MS: [-89.68, 32.74],
  MO: [-92.29, 38.46], MT: [-110.45, 46.92], NE: [-98.27, 41.13], NV: [-117.06, 38.31],
  NH: [-71.56, 43.45], NJ: [-74.52, 40.3], NM: [-106.25, 34.84], NY: [-74.95, 42.17],
  NC: [-79.81, 35.63], ND: [-99.78, 47.53], OH: [-82.76, 40.39], OK: [-96.93, 35.57],
  OR: [-122.07, 44.57], PA: [-77.21, 40.59], RI: [-71.51, 41.68], SC: [-80.95, 33.86],
  SD: [-99.9, 44.3], TN: [-86.69, 35.75], TX: [-97.56, 31.05], UT: [-111.86, 40.15],
  VT: [-72.71, 44.05], VA: [-78.17, 37.77], WA: [-121.49, 47.4], WV: [-80.95, 38.49],
  WI: [-89.62, 44.27], WY: [-107.3, 42.76],
  AB: [-114.46, 53.93], BC: [-123.0, 53.73], ON: [-85.32, 51.25], SK: [-106.0, 55.0],
  MB: [-98.74, 53.76],
};

const STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA",
  michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
  nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", alberta: "AB", "british columbia": "BC", ontario: "ON",
  saskatchewan: "SK", manitoba: "MB",
};

function stateCode(s: string | undefined): string {
  if (!s) return "";
  const t = s.trim();
  if (t.length === 2) return t.toUpperCase();
  return STATE_ABBR[t.toLowerCase()] ?? t.toUpperCase();
}

function validCoord(lat: unknown, lng: unknown): [number, number] | null {
  const la = Number(lat), ln = Number(lng);
  if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 85 && Math.abs(ln) <= 180 && (la !== 0 || ln !== 0)) {
    return [ln, la]; // [lng, lat]
  }
  return null;
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
  let text = (data.choices?.[0]?.message?.content ?? "").trim();
  // strip ```json fences if present
  text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

  const arr = sliceJson(text, "[", "]");
  if (arr) return JSON.parse(arr);
  // model sometimes wraps the array in an object, e.g. {"events":[...]}
  const obj = sliceJson(text, "{", "}");
  if (obj) {
    const parsed = JSON.parse(obj) as Record<string, unknown>;
    const firstArray = Object.values(parsed).find((v) => Array.isArray(v));
    if (firstArray) return firstArray;
  }
  throw new Error(`No JSON array in response: ${text.slice(0, 160)}`);
}

function sliceJson(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  if (start === -1 || end === -1 || end <= start) return null;
  const raw = text.slice(start, end + 1).replace(/,(\s*[\]}])/g, "$1"); // trailing commas
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    return null;
  }
}

// Resolve coordinates with layered fallbacks so a pin ALWAYS lands:
// model-provided lat/lng -> Mapbox v6 -> US Census -> state centroid.
async function resolveCoords(
  env: Env,
  opts: { city: string; state: string; lat?: number; lng?: number },
): Promise<[number, number]> {
  const code = stateCode(opts.state);

  // 0) Coordinates the model returned (validated).
  const fromModel = validCoord(opts.lat, opts.lng);
  if (fromModel) return fromModel;

  // 1) Mapbox v6 forward geocoder.
  if (env.MAPBOX_TOKEN && opts.city) {
    try {
      const url =
        `https://api.mapbox.com/search/geocode/v6/forward?country=US&limit=1` +
        `&place=${encodeURIComponent(opts.city)}&region=${encodeURIComponent(code)}` +
        `&access_token=${env.MAPBOX_TOKEN}`;
      const r = await fetch(url);
      if (r.ok) {
        const d = (await r.json()) as { features?: Array<{ geometry?: { coordinates?: [number, number] } }> };
        const c = d.features?.[0]?.geometry?.coordinates;
        const v = c ? validCoord(c[1], c[0]) : null;
        if (v) return v;
      }
    } catch {
      /* next */
    }
  }

  // 2) US Census geocoder (free, US only).
  if (opts.city) {
    try {
      const addr = `${opts.city}, ${code}`;
      const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(
        addr,
      )}&benchmark=Public_AR_Current&format=json`;
      const r = await fetch(url);
      if (r.ok) {
        const d = (await r.json()) as {
          result?: { addressMatches?: Array<{ coordinates?: { x: number; y: number } }> };
        };
        const co = d.result?.addressMatches?.[0]?.coordinates;
        const v = co ? validCoord(co.y, co.x) : null;
        if (v) return v;
      }
    } catch {
      /* next */
    }
  }

  // 3) State/province centroid — guaranteed.
  return STATE_CENTROID[code] ?? [-98.5, 39.8]; // geographic center of US
}

// Deterministic id so re-running the seed updates rather than duplicates rows.
async function stableId(prefix: string, ...parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join("|").toLowerCase());
  const digest = await crypto.subtle.digest("SHA-1", data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex.slice(0, 12)}`;
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

// Core seeding (no HTTP Context) so both the admin routes and the Cron trigger
// can call it.
export async function runSeedEvents(
  env: Env,
  state: string,
): Promise<{ inserted: number; events: Array<Record<string, unknown>> }> {
  const db = env.DB!;
  const report: Array<Record<string, unknown>> = [];
  const prompt = `List up to 12 real upcoming youth rodeo events (NHSRA, NJHRA, NLBRA, AJRA, or state junior rodeo associations) in ${state} for 2026. Return a JSON array; each item: {"name","association","disciplines":["..."],"venue","city","state","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","entry_deadline":"YYYY-MM-DD","fee_per_event":number,"lat":number,"lng":number,"source_url"}. Include the venue/city latitude and longitude as decimal degrees in lat/lng. Use real venues and cities. If a field is unknown, use null.`;
  const raw = (await perplexity(env, prompt)) as RawEvent[];

  const now = new Date().toISOString();
  for (const e of raw.slice(0, 12)) {
    if (!e?.name || !e?.city) continue;
    const st = stateCode(e.state || state);
    const [lng, lat] = await resolveCoords(env, { city: e.city, state: st, lat: e.lat, lng: e.lng });
    const id = await stableId("pe", e.name, e.city, st);
    await db
      .prepare(
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
        st,
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
    report.push({ name: e.name, city: e.city, state: st });
  }
  return { inserted: report.length, events: report };
}

export async function seedEvents(c: Context<{ Bindings: Env }>): Promise<Response> {
  const blocked = guard(c);
  if (blocked) return blocked;
  const state = (c.req.query("state") || "TX").toUpperCase();
  try {
    const r = await runSeedEvents(c.env, state);
    return c.json({ ok: true, state, ...r });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
}

export async function runSeedArenas(
  env: Env,
): Promise<{ inserted: number; arenas: Array<Record<string, unknown>> }> {
  const db = env.DB!;
  const report: Array<Record<string, unknown>> = [];
  const prompt = `List up to 10 real US rodeo arenas or fairgrounds that have faced closure, rezoning, development pressure, or noise complaints (or notable ones that were saved by community action). Return a JSON array; each: {"name","city","state","status":"threatened|watch|saved|safe","years_active":number,"threat":"short description","story":"1-2 sentences","economic_impact":number,"lat":number,"lng":number,"source_url"}. Include the venue latitude and longitude as decimal degrees in lat/lng. Use real places and real news.`;
  const raw = (await perplexity(env, prompt)) as RawArena[];

  const now = new Date().toISOString();
  for (const a of raw.slice(0, 10)) {
    if (!a?.name || !a?.city) continue;
    const st = stateCode(a.state);
    const [lng, lat] = await resolveCoords(env, { city: a.city, state: st, lat: a.lat, lng: a.lng });
    const id = await stableId("pa", a.name, a.city, st);
    await db
      .prepare(
        `INSERT OR REPLACE INTO map_arenas
         (id,name,city,state,status,years_active,threat,story,economic_impact,lat,lng,source,source_url,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id,
        a.name,
        a.city,
        st || null,
        a.status ?? "watch",
        a.years_active ?? null,
        a.threat ?? null,
        a.story ?? null,
        a.economic_impact ?? null,
        lat,
        lng,
        "perplexity",
        a.source_url ?? null,
        now,
      )
      .run();
    report.push({ name: a.name, city: a.city, status: a.status });
  }
  return { inserted: report.length, arenas: report };
}

export async function seedArenas(c: Context<{ Bindings: Env }>): Promise<Response> {
  const blocked = guard(c);
  if (blocked) return blocked;
  try {
    const r = await runSeedArenas(c.env);
    return c.json({ ok: true, ...r });
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
