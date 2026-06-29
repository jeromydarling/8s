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
import {
  signup, login, logout, me, addContestant, addHorse, deleteRecord,
  toggleWatch, saveAlertSub, listAlerts, markAlertsRead, submitEvent, track,
  verifyToken, resendVerification, requestReset, performReset, purgeUser,
} from "./account";
import { runAlerts } from "./alerts";
import { getPlans, postCheckout, postPortal, postWebhook } from "./billing";
import * as Sentry from "@sentry/cloudflare";

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
  SESSION_SECRET?: string; // secret, signs session cookies
  RESEND_API_KEY?: string; // secret, fallback email delivery (optional)
  EMAIL?: SendEmail; // Cloudflare Email Service send_email binding
  SENTRY_DSN?: string; // secret, server-side Sentry DSN (worker + cron errors)
  EMAIL_VERIFICATION?: string; // "on" to require email verification (default off)
  STRIPE_SECRET_KEY?: string; // secret, Stripe API key (live)
  STRIPE_WEBHOOK_SECRET?: string; // secret, Stripe webhook signing secret
  STRIPE_PRICE_FAMILY?: string; // price_... for Arena Family $79/yr
  STRIPE_PRICE_PRO?: string; // price_... for Arena Pro $19.99/mo
  STRIPE_PRICE_ASSOCIATIONS?: string; // price_... for Associations $49/mo
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
  c.json({
    mapboxToken: c.env.MAPBOX_TOKEN ?? null,
    mapsEnabled: !!c.env.MAPBOX_TOKEN,
    billingEnabled: !!c.env.STRIPE_SECRET_KEY,
  }),
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

// ---- Accounts & auth -------------------------------------------------------
app.post("/api/auth/signup", (c) => signup(c));
app.post("/api/auth/login", (c) => login(c));
app.post("/api/auth/logout", (c) => logout(c));
app.get("/api/me", (c) => me(c));
app.post("/api/auth/verify", (c) => verifyToken(c));
app.post("/api/auth/resend-verification", (c) => resendVerification(c));
app.post("/api/auth/request-reset", (c) => requestReset(c));
app.post("/api/auth/reset", (c) => performReset(c));

// Token-guarded test-user cleanup (E2E): /api/admin/purge-user?token=...&email=...
app.post("/api/admin/purge-user", (c) => purgeUser(c));
app.get("/api/admin/purge-user", (c) => purgeUser(c));

// Token-guarded email smoke test: /api/admin/test-email?token=...&to=you@x.com
app.get("/api/admin/test-email", async (c) => {
  if (c.req.query("token") !== c.env.ART_INGEST_TOKEN) return c.json({ error: "forbidden" }, 403);
  const to = c.req.query("to");
  if (!to) return c.json({ error: "add &to=email" }, 400);
  const { sendMailDebug } = await import("./email");
  const r = await sendMailDebug(c.env, {
    to,
    subject: "8 Seconds — email test",
    text: "If you can read this, transactional email is working. — 8 Seconds",
    html: "<p>If you can read this, transactional email is working.</p><p>— 8 Seconds</p>",
  });
  return c.json(r);
});

// ---- User data -------------------------------------------------------------
app.post("/api/contestants", (c) => addContestant(c));
app.post("/api/horses", (c) => addHorse(c));
app.delete("/api/:kind/:id", (c) => deleteRecord(c));
app.post("/api/watch", (c) => toggleWatch(c));

// ---- Alerts ----------------------------------------------------------------
app.post("/api/alerts/subscribe", (c) => saveAlertSub(c));
app.get("/api/alerts", (c) => listAlerts(c));
app.post("/api/alerts/read", (c) => markAlertsRead(c));

// ---- Supply side + analytics ----------------------------------------------
app.post("/api/submit-event", (c) => submitEvent(c));
app.post("/api/track", (c) => track(c));

// ---- SPA fallback: hand everything else to static assets -------------------
// ---- Stripe billing --------------------------------------------------------
app.get("/api/billing/plans", (c) => getPlans(c));
app.post("/api/billing/checkout", (c) => postCheckout(c));
app.post("/api/billing/portal", (c) => postPortal(c));
app.post("/api/billing/webhook", (c) => postWebhook(c));

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

// States to refresh on the weekly cron (highest youth-rodeo density).
const CRON_STATES = ["TX", "OK", "WY", "CO", "KS", "NM"];

const handler = {
  fetch: app.fetch,
  // Crons: daily (13:00 UTC) computes deadline alerts; weekly (Mon) also
  // refreshes real events/arenas via Perplexity. No-ops cleanly without keys/DB.
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (!env.DB) return;
    const isWeekly = event.cron === "0 13 * * 1";
    ctx.waitUntil(
      (async () => {
        if (isWeekly && env.PERPLEXITY_API_KEY) {
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
        }
        // Alerts run every day (after any weekly reseed).
        try {
          await runAlerts(env);
        } catch (e) {
          console.error("cron alerts", e);
        }
      })(),
    );
  },
};

// Wrap the FULL { fetch, scheduled } handler — not just the Hono app — so the
// daily/weekly cron failures are captured too, not only request errors.
// Federation-standard tags keep events comparable across the fleet; this
// no-ops gracefully when SENTRY_DSN is unset (graceful degradation).
export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    initialScope: {
      tags: {
        app_slug: "8seconds",
        federation_phase: "pre-launch",
      },
    },
  }),
  handler,
) satisfies ExportedHandler<Env>;
