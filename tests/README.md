# E2E tests (Playwright) — fleet template

Real headless-browser click-tests that load the **deployed** site and walk the
critical paths. Designed to be copied across the app fleet with minimal edits.

## Run
```bash
npx playwright install chromium   # once, locally (CI installs it automatically)
npm run test:e2e                  # against https://8s.rodeo
BASE_URL=http://localhost:5173 npm run test:e2e   # against a local dev server
RUN_AUTH=1 npm run test:e2e       # also exercise signup + persistence (creates throwaway accounts)
npm run test:e2e:ui               # interactive debugger
```

## Files
- `playwright.config.ts` — desktop + mobile (Pixel 7) projects; `BASE_URL` env
  (default prod); video + screenshot + trace captured on failure.
- `e2e/smoke.spec.ts` — public surfaces, no auth: brand/hero, ungated-demo CTA
  routing, video modal, `/submit`, and API/SEO (`/api/health`, `/api/config`,
  `/api/events` geocoding, `/sitemap.xml`). Safe to run on prod anytime.
- `e2e/app.spec.ts` — activation path: signup → add-horse / enter-event, each
  asserting **persistence survives a reload** (D1, not React state). Gated behind
  `RUN_AUTH=1`. The bad-login error path runs always.

## CI
`.github/workflows/e2e.yml` runs on every push to `main` (smoke only) and via
**Run workflow** (pick a URL, toggle the auth flow). Failures upload an HTML
report + video as an artifact.

## Porting to another app
1. Copy `playwright.config.ts`, `.github/workflows/e2e.yml`, this folder.
2. `npm i -D @playwright/test`.
3. Rewrite the selectors in the two specs for that app's UI (keep the
   load → core-action → reload-persists shape).
4. Point `BASE_URL` default at that app's domain.
