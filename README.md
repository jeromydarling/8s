# 8 Seconds — `8s.rodeo`

**The hub built by a rodeo family, for rodeo families.** Youth rodeo, all in one
place: every event, every qualifying ladder, every horse, and every arena worth
fighting for. A production-ready MVP on Cloudflare — marketing site + a fully
seeded, functional demo app.

> Ported from *In Motu* (youth motocross) to the youth-rodeo market. Mobile-first.
> Women and girls at the center. The horse treated as a first-class athlete.

---

## System architecture

```
                       ┌──────────────────────────────────────────┐
   8s.rodeo  ──────▶   │   Cloudflare Worker (Hono)  worker/index  │
                       │                                            │
                       │   /api/demo      seeded dataset            │
                       │   /api/leads     gated-demo lead capture   │
                       │   /api/import    AI data import (Llama)    │
                       │   /api/art/:slug AI watercolor (FLUX)      │
                       │   /*             SPA static assets         │
                       └───────┬───────────────┬───────────┬───────┘
                               │               │           │
                  Workers AI ◀─┘   D1 / KV ◀────┘   R2 ◀────┘
                  (import +        (leads,           (uploads +
                   imagery)         write-back)       generated art)
```

A single Worker serves both the React SPA (static assets) and the JSON API.
Everything degrades gracefully: **with zero provisioned bindings the site and the
full demo still work** (bundled seed data, heuristic import, crafted-SVG art).
Adding bindings progressively lights up persistence, AI import, and AI imagery.

- **Frontend:** React 18 + Vite 6 + TypeScript (strict), React Router, Tailwind
  CSS v4, Framer Motion. Code-split: marketing bundle vs. demo-app bundle.
- **Backend:** Hono on Workers. Stateless; all heavy lifting via bindings.
- **AI:** Workers AI — `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (import
  synthesis) and `@cf/black-forest-labs/flux-1-schnell` (watercolor marketing art),
  cached in `caches.default` and R2.

## File structure

```
8s/
├── index.html                 SPA entry + fonts + meta
├── vite.config.ts             React + Cloudflare + Tailwind plugins
├── wrangler.jsonc             Worker config (assets, AI; optional D1/KV/R2)
├── shared/
│   ├── types.ts               Domain model (shared by Worker + SPA)
│   └── seed.ts                 The Hollis-family demo dataset (source of truth)
├── worker/
│   ├── index.ts               Hono app + routes + Env
│   ├── import.ts              AI import + deterministic fallback parser
│   ├── art.ts                 AI imagery + layered watercolor-SVG fallback
│   └── db/
│       ├── migrations/0001_init.sql
│       └── seed.sql
└── src/
    ├── main.tsx · App.tsx     Router (marketing `/`, demo `/app/*`)
    ├── index.css              Design system: palette, paper grain, motion
    ├── lib/                   api client · demo data context · unlock state
    ├── components/ui.tsx      Rowel mark, Wordmark, Reveal, Counter, Button…
    ├── marketing/             Home, Nav, Hero, sections, MiniApp, DemoGate
    └── app/                   DemoApp shell + 5 modules + Import + Budget
```

## The product — five rooms under one roof

| Module | Route | What it does |
|---|---|---|
| **The Draw** | `/app/draw` | Unified event feed across associations; filters; deadline countdowns; one-tap enter |
| **The Buckle Board** | `/app/buckle` | Per-contestant qualifying ladders, points, stages, deadlines |
| **The Tack Room** | `/app/tack` | Family + **horse** profiles, farrier/vet reminders, run log |
| **The Sponsor Pen** | `/app/sponsor` | Shareable media kit, sponsor tiers, deliverable tracking |
| **The Gatepost** | `/app/gatepost` | Arena-preservation advocacy: endangered map, petitions, impact |
| **Import (AI)** | `/app/import` | Paste any format → AI synthesizes clean rodeo records |

## Database schema

See `worker/db/migrations/0001_init.sql`. Core tables: `leads`, `families`,
`contestants`, `horses`, `events`, `runs`, `sponsors`, `arenas`. The app reads the
demo from bundled seed (`shared/seed.ts`); D1 is only required for persistent
lead capture and write-back.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Status + which bindings are live |
| `GET` | `/api/demo` | Full seeded demo dataset |
| `POST` | `/api/leads` | Capture gated-demo lead (D1 → KV → log), sets demo cookie |
| `POST` | `/api/import` | `{ text, filename }` → AI-synthesized records |
| `GET` | `/api/art/:slug` | Watercolor image (FLUX → R2/cache → SVG fallback) |
| `GET` | `/api/billing/plans` | Public plan labels + display prices |
| `POST` | `/api/billing/checkout` | `{ plan }` → Stripe Checkout URL (subscription) |
| `POST` | `/api/billing/portal` | Stripe billing-portal URL (manage/cancel) |
| `POST` | `/api/billing/webhook` | Stripe events → sync `users.plan` in D1 |

## Local development

```bash
npm install
npm run dev        # requires `wrangler login` for Workers AI in dev
npm run build      # tsc (strict) + vite build → dist/  ✅ CI-safe offline
```

> Workers AI runs remotely, so `npm run dev` needs a Cloudflare login. The
> production **build** has no such requirement and is what Workers Builds runs.

## Deploy + provisioning (run on waking)

The Worker + domain + GitHub repo are already wired to **Cloudflare Workers
Builds**, so pushing this branch builds and deploys. To go from "works" to "fully
powered":

```bash
# 1) Workers AI — already enabled via the `ai` binding in wrangler.jsonc. Nothing to do.

# 2) (Optional) Persistent leads + write-back
wrangler d1 create eight_seconds_db          # paste database_id into wrangler.jsonc
wrangler kv namespace create LEADS           # paste id into wrangler.jsonc
#   then uncomment the d1_databases / kv_namespaces blocks in wrangler.jsonc
npm run db:migrate:remote
npm run db:seed:remote                        # optional mirror of demo data

# 3) (Optional) Persist generated watercolor art across deploys
wrangler r2 bucket create eight-seconds-media
wrangler r2 bucket create eight-seconds-uploads
#   then uncomment the r2_buckets block in wrangler.jsonc

# 4) Deploy (or just push — Workers Builds handles it)
npm run deploy
```

Attach the route to `8s.rodeo` in the Worker's **Settings → Domains & Routes**
if it isn't already.

## Design notes

Warm paper + leather palette, animated paper grain, watercolor washes, an
8-second ride-timer motif, scroll-reveal motion throughout, and a community voice
of solidarity and belonging — the Great American West, never kitsch. Watercolor
over photorealism by design.

<!-- deploy-trigger: 2026-06-06T01:46:15Z (Sentry DSN bake-in) -->