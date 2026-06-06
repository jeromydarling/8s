# PROMPT: Add an end-to-end "real user does everything" test rig (Claude Code + Cloudflare apps)

Paste this whole prompt into Claude Code on any of my Cloudflare Workers + React/Vite
apps. It sets up Playwright E2E tests that run a **real headless browser** through the
**entire new-user journey** (sign up → use every feature → verify persistence → sign
out) against the **deployed** site, in GitHub Actions, on every push.

Copy this prompt verbatim; Claude should adapt the specifics to the app it's in.

---

## Your task

Build a Playwright end-to-end test rig that signs up a brand-new user and exercises
**everything a real user can do** in this app, then runs it automatically in CI with
video/screenshot/trace proof. Work autonomously: read the codebase, write the specs,
push, watch the CI run, read failures from logs, fix, and repeat until **green**. Do
not declare success until a CI run actually passes — prove it.

## Hard rules (learned the hard way — follow exactly)

1. **This sandbox cannot run a browser.** `npx playwright install chromium` fails here
   (egress is blocked) and there's no system Chrome. **Do not try to run the tests
   locally.** They run in **GitHub Actions** (Chromium is available there). Locally you
   may only validate that specs parse with `npx playwright test --list`.

2. **Tests run against the DEPLOYED site**, not a local dev server (we can't run one
   here). Default `BASE_URL` to the production URL; allow override via env.

3. **DISABLE EMAIL VERIFICATION during the test.** A new signup must be able to use the
   whole app immediately. Implement a server flag, default OFF, e.g.
   `EMAIL_VERIFICATION` env var on the Worker — when not `"on"`, signup creates the user
   already-verified and skips the confirm step (still send a welcome email if you have
   one). The journey must NOT depend on clicking an email link. Make re-enabling a
   one-variable change and say so in the summary.

4. **Set `reducedMotion: "reduce"` in the Playwright config `use` block.** Framer-motion
   / CSS animations keep elements "unstable" and make `.click()` time out (45s). This
   single setting collapses animations to instant and kills a whole class of flake.
   (Ensure the app's CSS actually honors `@media (prefers-reduced-motion: reduce)` — most
   do; if not, add it.)

5. **Add a token-guarded test-user PURGE endpoint** so repeated CI runs don't pile up
   junk accounts in the DB. e.g. `POST /api/admin/purge-user?token=...&email=...` that
   deletes the user and ALL their child rows (roster, watchlist, alerts, tokens, etc.).
   The journey's `afterAll` calls it. Reuse an existing admin token if one exists.

6. **Selectors — avoid the traps I hit:**
   - Don't assert on nav links that differ by viewport (a desktop sidebar is
     `hidden`/`display:none` on mobile and vice-versa). Assert on something present in
     **both** layouts — usually the page's `<h1>` heading via
     `getByRole("heading", { name: /.../i })`.
   - Use `{ exact: true }` for short button labels ("Enter", "All", "Map", "List") so
     "Enter" doesn't also match "Entered".
   - For OR-regex text that may match multiple nodes, append `.first()` (Playwright
     strict mode fails on >1 match).
   - Don't assert on lazily-loaded / third-party widgets (e.g. a Mapbox canvas mounts via
     IntersectionObserver and depends on a token). Assert on adjacent app-rendered text
     instead (a heading, a summary stat, a real number).
   - `await expect(locator).toBeVisible({ timeout: 15000 })` before clicking elements
     that appear after a route change or data fetch.

7. **Persistence is the point.** For every create/toggle action a user can do
   (add a record, "enter"/favorite something, save a setting): perform it, **reload the
   page**, and assert it's still there. That proves it hit the database, not just React
   state. This is the #1 thing that catches "looks like it works but saves nothing" bugs.

8. **Serial journey, one shared account.** Use `test.describe.configure({ mode: "serial" })`
   and a single `page` created in `beforeAll`, so each step builds on the last (sign up
   once, then walk the app). A unique email per run: `e2e+journey-${Date.now()}@<domain>`.

9. **Watch CI from here.** After pushing, use the GitHub MCP tools
   (`mcp__github__actions_list` / `actions_get` / `get_job_logs` with
   `failed_only:true, return_content:true`) to read the result. If a `list` result is
   huge and gets saved to a file, slice it with `python3 -c "print(open(F).read()[A:B])"`
   or do it in a sub-agent so it stays out of context. Read the exact failing
   `file:line`, locator, and error; fix precisely; push again. Expect 2–4 iterations —
   each failure is normally a test-selector issue, not an app bug (note which in your
   commits).

10. **Author identity for commits:** set `git config user.email noreply@anthropic.com`
    and `user.name Claude` so commits show verified.

## What to build (files)

- `playwright.config.ts` — `testDir: ./tests/e2e`; projects for **desktop** (Desktop
  Chrome) and **mobile** (Pixel 7); `use`: `baseURL` from `process.env.BASE_URL ||
  "<PROD_URL>"`, `reducedMotion: "reduce"`, `screenshot: "only-on-failure"`,
  `video: "retain-on-failure"`, `trace: "on-first-retry"`; `retries: process.env.CI ? 2 : 0`;
  reporter `[["github"],["html",{open:"never"}]]` on CI.

- `tests/e2e/smoke.spec.ts` — public surfaces, no auth, safe to run on prod anytime:
  home loads + title + hero `<h1>`; primary CTA routes correctly; key marketing
  sections; and direct API checks via the `request` fixture for every health/list
  endpoint (`/api/health`, config, any public data feed) asserting shape (e.g. required
  fields present).

- `tests/e2e/journey.spec.ts` — THE full journey, serial, one account, auto-cleaned:
  1. Land on marketing → enter the app.
  2. **Sign up** as a new user (fill the real signup form; assert signed-in state by the
     "Sign in" control disappearing or the account chip appearing).
  3–N. Visit **every screen/tab** and perform **every interaction** a user can: create
     records (assert **persist across reload**), toggles/favorites (assert persist),
     filters, view switches, any AI/long-running action (bump that step's timeout, e.g.
     30s), forms, settings. Enumerate the app's real features by reading the routes/nav
     in the codebase — cover all of them.
  Final: assert the **session survives a cold reload**, then **sign out**.
  `afterAll`: call the purge endpoint to delete the test account.

- `tests/e2e/app.spec.ts` (optional) — negative paths that don't create accounts, e.g.
  login with bad credentials shows an error.

- `.github/workflows/e2e.yml` — on `push` to `main` + `workflow_dispatch` (input:
  `base_url`, default prod). Steps: checkout; setup-node 22 w/ npm cache; `npm ci`;
  `npx playwright install --with-deps chromium`; run
  `npx playwright test --project=desktop --project=mobile` with `BASE_URL` and the admin
  token in env (from a repo secret, with the known token as a fallback default); always
  upload `playwright-report/` as an artifact.

- `tests/README.md` — short doc: how to run, the env knobs (`BASE_URL`, verification
  flag), and the porting recipe.

- `package.json` — `"test:e2e": "playwright test"`, `"test:e2e:ui": "playwright test --ui"`;
  add `@playwright/test` to devDependencies. Gitignore `playwright-report/`,
  `test-results/`, `/playwright/.cache/`.

## Build / safety checks

- The tests import `@playwright/test`; make sure they're **excluded from the app/worker
  `tsc` build** (don't add `tests/` to tsconfig includes) so `npm run build` is
  unaffected. Verify `npm run build` still passes.
- Verify `npx playwright test --list` enumerates all specs with no parse errors before
  pushing.
- Any new server endpoints (purge, verification flag) must compile and be wired into the
  Worker router and `Env` type.

## Definition of done

A GitHub Actions E2E run on `main` is **green**, having actually signed up a new user and
clicked through every feature on **both desktop and mobile**, with persistence verified
by reloads, and the test account cleaned up afterward. Report the run number, the test
count, and confirm the deployed app passed. State plainly that email verification is
disabled (and the one var to re-enable it).
