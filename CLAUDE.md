# 8 Seconds — `8s.rodeo`

Youth-rodeo family hub. Cloudflare Worker (Hono) serving a React/Vite SPA + JSON API.
See `README.md` for full architecture, schema, API, and provisioning.

## Working agreements (read first)

- **Branch:** Develop and commit **directly on `main`**. Do not create feature
  branches. Every change should land on `main` and deploy from there.
- **Deploy:** The repo is connected to **Cloudflare Workers Builds** (Worker name
  `8s`, attached to `8s.rodeo`). It must run **`npm run build` as the Build command**
  before the deploy command `npx wrangler deploy` — the Vite plugin generates the
  deploy config (`dist/8s/wrangler.json` + `.wrangler/deploy/config.json`) during
  build. If the dashboard Build command is empty, deploys fail with
  "assets … missing the required `directory`".
- **Verify before pushing:** `npm run build` must pass (strict `tsc` + Vite).
- **Graceful degradation:** the app must keep working with missing bindings
  (bundled seed, heuristic import, SVG art). Never hard-require a binding.

## Provisioned Cloudflare resources

- **D1** `eight_seconds_db` — id `2ed05721-0fdc-42fa-8629-b7f2a3f3ac2d` (binding `DB`).
  Migrations 0001–0003 applied. Tables: leads, demo mirror, map_events/map_arenas
  (Perplexity-seeded), plus accounts/persistence: users, contestants_u, horses_u,
  watchlist, alert_subs, alerts, event_submissions, analytics_events.
- **Workers AI** — binding `AI` (import synthesis + watercolor art).
- **R2** — `eight-seconds-media` (art + music cache), `eight-seconds-uploads`.

## Secrets / vars (set on the `8s` Worker)

- `MAPBOX_TOKEN` (var, public pk.*) — maps + geocoding.
- `PERPLEXITY_API_KEY` (secret) — real-event seeding.
- `ELEVEN_LABS_API_KEY` (secret) — demo-video music generation.
- `ART_INGEST_TOKEN` (var) — guards /api/admin/* + the GitHub seed workflow.
- `SESSION_SECRET` (secret, **recommended**) — signs auth session cookies; falls
  back to a fixed dev secret if unset (fine for preview, set before real users).
- `RESEND_API_KEY` (secret, optional) — sends deadline-alert emails; without it,
  alerts still appear in-app and the cron logs intended sends.
- `SENTRY_DSN` (secret, optional) — server-side Sentry DSN for the worker; captures
  request + cron errors. Unset → Sentry no-ops. Client uses build-time
  `VITE_SENTRY_DSN` (see `.env.example`).

## Crons

- Daily `0 13 * * *` — compute deadline alerts (`worker/alerts.ts`).
- Weekly `0 13 * * 1` — also reseed real events/arenas via Perplexity.
- On-demand: GitHub Actions "Seed real rodeo data" workflow (manual button).

## Product surfaces

- Marketing `/` (ungated — CTAs go straight to `/app`), `/submit` (supply side).
- App `/app/*` — works as a preview for anyone; signing in (AuthModal) persists
  roster + watchlist + alerts to D1. Real events from `/api/events`.
- SEO: build-time static `/rodeos/<state>/` + per-event pages (scripts/gen-seo.mjs).
- PWA: `public/manifest.webmanifest` + `public/sw.js` (installable, offline shell).
- Analytics: first-party `/api/track` → `analytics_events` (src/lib/track.ts).

## Conventions

- Shared domain types in `shared/types.ts`; demo data source of truth in `shared/seed.ts`.
- Tailwind v4 theme tokens in `src/index.css`; avoid dynamically-built class names.
- Worker routes under `/api/*`; everything else falls through to static assets (SPA).
