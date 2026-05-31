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

- **D1** `eight_seconds_db` — id `2ed05721-0fdc-42fa-8629-b7f2a3f3ac2d`
  (binding `DB`; schema applied; persistent lead capture + write-back).
- **Workers AI** — binding `AI` (import synthesis + watercolor art). No provisioning.
- **R2** — not yet enabled on the account. When enabled, create
  `eight-seconds-media` / `eight-seconds-uploads` and uncomment the `r2_buckets`
  block in `wrangler.jsonc` for cross-deploy art persistence + uploads.

## Conventions

- Shared domain types in `shared/types.ts`; demo data source of truth in `shared/seed.ts`.
- Tailwind v4 theme tokens in `src/index.css`; avoid dynamically-built class names.
- Worker routes under `/api/*`; everything else falls through to static assets (SPA).
