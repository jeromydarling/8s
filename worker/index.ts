import { Hono } from "hono";
import { cors } from "hono/cors";
import { demoData } from "../shared/seed";
import type { ImportResult, Lead } from "../shared/types";
import { runImport } from "./import";
import { generateArt, ingestArt } from "./art";
import {
  seedEvents,
  seedArenas,
  listEvents,
  listArenas,
  runSeedEvents,
  runSeedArenas,
} from "./seed-events";
import { music, musicStatus } from "./music";

export interface Env {
  ASSETS: Fetcher;
  AI?: Ai;
  DB?: D1Database;
  LEADS?: KVNamespace;
  MEDIA?: R2Bucket;
  UPLOADS?: R2Bucket;
  APP_NAME: string;
  APP_DOMAIN: string;
  ART_INGEST_TOKEN?: string;
  MAPBOX_TOKEN?: string; // public pk.* token for Mapbox GL
  PERPLEXITY_API_KEY?: string; // secret, server-side seeding only
  ELEVEN_LABS_API_KEY?: string; // secret, demo-video music generation
}

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    app: c.env.APP_NAME,
    bindings: {
      ai: !!c.env.AI,
      db: !!c.env.DB,
      leads: !!c.env.LEADS,
      media: !!c.env.MEDIA,
    },
  }),
);

// ---- Public client config (Mapbox token etc.) -----------------------------
app.get("/api/config", (c) =>
  c.json({ mapboxToken: c.env.MAPBOX_TOKEN ?? null, mapsEnabled: !!c.env.MAPBOX_TOKEN }),
);

// ---- Fully seeded demo dataset ---------------------------------------------
app.get("/api/demo", (c) => c.json(demoData));

// ---- Lead capture (form-gated demo CTA) ------------------------------------
app.post("/api/leads", async (c) => {
  let body: Lead;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }

  if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email) || !body?.name) {
    return c.json({ error: "Name and a valid email are required." }, 422);
  }

  const lead: Lead = {
    id: crypto.randomUUID(),
    name: String(body.name).slice(0, 120),
    email: String(body.email).slice(0, 160).toLowerCase(),
    role: String(body.role ?? "").slice(0, 60),
    org: String(body.org ?? "").slice(0, 120),
    state: String(body.state ?? "").slice(0, 40),
    disciplines: String(body.disciplines ?? "").slice(0, 200),
    createdAt: new Date().toISOString(),
  };

  // Persist best-effort: D1 → KV → log. Never block the user from the demo.
  try {
    if (c.env.DB) {
      await c.env.DB.prepare(
        `INSERT INTO leads (id, name, email, role, org, state, disciplines, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
        .bind(
          lead.id,
          lead.name,
          lead.email,
          lead.role,
          lead.org,
          lead.state,
          lead.disciplines,
          lead.createdAt,
        )
        .run();
    } else if (c.env.LEADS) {
      await c.env.LEADS.put(`lead:${lead.createdAt}:${lead.id}`, JSON.stringify(lead));
    } else {
      console.log("[lead]", JSON.stringify(lead));
    }
  } catch (err) {
    console.error("lead persistence failed", err);
  }

  // Grant a short-lived demo pass cookie so /app is unlocked.
  const token = btoa(`${lead.id}:${Date.now()}`);
  c.header(
    "Set-Cookie",
    `eight_demo=${token}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`,
  );
  return c.json({ ok: true, demoToken: token });
});

// ---- AI-powered data import ------------------------------------------------
app.post("/api/import", async (c) => {
  let payload: { text?: string; filename?: string };
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid request" }, 400);
  }
  const text = (payload.text ?? "").slice(0, 12_000);
  if (!text.trim()) return c.json({ error: "Paste some data to import." }, 422);

  const result: ImportResult = await runImport(text, payload.filename ?? "pasted-data", c.env.AI);
  return c.json(result);
});

// ---- AI watercolor art generation ------------------------------------------
// GET /api/art/:slug — returns a cached PNG. Falls back to a crafted SVG when
// Workers AI is unavailable, so the marketing site always renders.
app.get("/api/art/:slug", async (c) => {
  const slug = c.req.param("slug");
  return generateArt(c, slug);
});

// One-time curated-art ingest (token-guarded). The Worker fetches the source
// URL(s) and stores them in R2 as the authoritative art.
app.get("/api/admin/ingest-art", (c) => ingestArt(c));

// Real-data map feeds (D1, seeded via Perplexity) + admin seeding endpoints.
app.get("/api/events", (c) => listEvents(c));
app.get("/api/arenas", (c) => listArenas(c));
app.post("/api/admin/seed-events", (c) => seedEvents(c));
app.post("/api/admin/seed-arenas", (c) => seedArenas(c));

// Demo-video background music (ElevenLabs, cached in R2).
app.get("/api/music/status", (c) => musicStatus(c));
app.get("/api/music", (c) => music(c));

// ---- SPA fallback: hand everything else to static assets -------------------
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

// States to refresh on the weekly cron (highest youth-rodeo density).
const CRON_STATES = ["TX", "OK", "WY", "CO", "KS", "NM"];

export default {
  fetch: app.fetch,
  // Weekly Cron: refresh real events for key states + arenas. No-ops cleanly if
  // PERPLEXITY_API_KEY / DB are missing.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (!env.PERPLEXITY_API_KEY || !env.DB) return;
    ctx.waitUntil(
      (async () => {
        for (const state of CRON_STATES) {
          try {
            await runSeedEvents(env, state);
          } catch (e) {
            console.error("cron seed-events", state, e);
          }
        }
        try {
          await runSeedArenas(env);
        } catch (e) {
          console.error("cron seed-arenas", e);
        }
      })(),
    );
  },
};
