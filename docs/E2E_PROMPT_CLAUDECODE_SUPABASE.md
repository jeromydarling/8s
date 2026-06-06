# PROMPT: Add an end-to-end "real user does everything" test rig (Claude Code + Supabase apps)

Paste this whole prompt into Claude Code on a React/Vite app whose backend is **Supabase**
(auth + Postgres, possibly Edge Functions), deployed somewhere public (Vercel/Netlify/
Cloudflare Pages/etc.) with a connected **GitHub repo**.

It sets up Playwright E2E tests that run a **real headless browser** through the **entire
new-user journey** (sign up → use every feature → verify persistence → sign out) against
the **deployed** site, in GitHub Actions, on every push.

Copy this verbatim; adapt the specifics to the app you're in.

---

## Step 0 — Learn the app front to back BEFORE writing a single test

You cannot test what you don't understand. Do not write any spec until you have built a
complete mental map of this app. A journey that "signs up and clicks a couple things" is
a failure of this task — the whole point is to exercise **everything a real user can do**,
and you can only enumerate that by reading the app first.

Spend real effort here, then write down what you found:

- **Routes & navigation.** Read the router (React Router routes, file-based routes, or the
  nav components) and list **every** screen/route a signed-in user can reach, plus every
  public route. Note which are gated behind auth.
- **Auth flow.** Find the actual sign-up / sign-in UI (component, form fields, their
  placeholders/labels, the submit button text) and how the app talks to Supabase
  (`supabase.auth.signUp` / `signInWithPassword`, an auth context/provider, redirects on
  success). You'll need the exact selectors later — capture them now.
- **Every user-facing feature & interaction.** For each route, enumerate what a user can
  actually *do*: forms, create/edit/delete actions, toggles, filters, view switches,
  uploads, search, settings, any AI/long-running action. This list becomes the journey's
  steps — there should be roughly one journey step per feature.
- **What persists, and where.** Find the `.from("…").insert(`/`update(`/`upsert(` calls and
  which tables they write to, plus the `user_id`/`owner` columns. This tells you (a) what
  to re-check after reload, and (b) exactly which tables the cleanup script must purge.
- **Data dependencies & empty states.** Notice features that need pre-existing data (e.g. a
  list that's empty for a brand-new account) so a step doesn't assert on something a fresh
  user could never see. Plan to *create* the data in an earlier step.
- **The deployed URL and the Supabase project** (URL + which env vars the client uses).

**Deliverable for Step 0:** before writing specs, produce a short written inventory — the
route list, the auth selectors, the per-route feature/interaction checklist, and the
owned-tables list — and use it as the checklist the journey spec must cover. If anything
is ambiguous, read the component; don't guess. When you later report done, the journey
must visibly cover that inventory.

## Your task

Build a Playwright E2E rig that signs up a brand-new user and exercises **everything a
real user can do** in this app, then runs it automatically in CI with video/screenshot/
trace proof. **Work autonomously, end to end:** first **learn the app front to back
(Step 0)**, then write the specs, commit, push, watch the CI run via the GitHub tools,
read failures from the logs, fix, and repeat until a CI run is actually **green**. Do not
declare success until a run passes — prove it with the run number.

## Hard rules (learned the hard way — follow exactly)

1. **This sandbox cannot run a browser.** `npx playwright install chromium` fails here
   (egress is blocked) and there's no system Chrome. **Do not try to run the tests
   locally.** They run in **GitHub Actions** (Chromium is available there). Locally you
   may only validate that specs parse with `npx playwright test --list`.

2. **Tests run against the DEPLOYED site**, not a local dev server (we can't run one
   here). Default `BASE_URL` to the production/preview URL; allow override via env.

3. **DISABLE EMAIL CONFIRMATION during the test — this is a Supabase setting, not app
   code.** A new signup must reach the app immediately without clicking an email link.
   You (Claude) cannot toggle this. **STOP and tell me to do exactly this:** Supabase
   Dashboard → **Authentication → Sign In / Providers → Email → turn "Confirm email"
   OFF** (newer UI: Authentication → Providers → Email). Without it,
   `supabase.auth.signUp()` returns a session-less user and the journey can't proceed.
   - If I'd rather keep confirmation ON in Supabase, implement the alternative: in CI,
     create the test user **pre-confirmed** with the service-role Admin API
     (`auth.admin.createUser({ email, password, email_confirm: true })`) in a
     `globalSetup`, then sign in through the real UI. Pick this only if I ask.
   - Either way, note in your summary how to restore confirmation before real launch.

4. **Set `reducedMotion: "reduce"` in the Playwright config `use` block.** Framer-motion /
   Tailwind / shadcn animations keep elements "unstable" and make `.click()` time out
   (default 45s). This collapses animations to instant and kills a whole class of flake.
   Confirm the app's CSS honors `@media (prefers-reduced-motion: reduce)`; if a custom
   animation doesn't, that's fine — the setting still helps most cases.

5. **Clean up the test user via the Supabase SERVICE-ROLE key (a GitHub secret), never
   app/client code.** Repeated CI runs must not pile up auth users + orphan rows.
   - Write `scripts/purge-e2e-user.ts` (Node, uses `@supabase/supabase-js` with the
     service-role key) that, given an email: finds the auth user, deletes their rows from
     each owned table (`delete().eq("user_id", id)` — service-role bypasses RLS), then
     `auth.admin.deleteUser(id)`.
   - The journey spec's `afterAll` shells out to it (or imports it) with the test email.
   - **Tell me to add GitHub Actions secrets:** `SUPABASE_URL`,
     `SUPABASE_SERVICE_ROLE_KEY`. Never commit the service-role key; never expose it to
     the browser/test page — it's used only in the Node cleanup step.
   - Discover the owned tables from the codebase (look for `.from("…").insert(` calls
     with a `user_id`/`owner` column) so cleanup covers everything the journey creates.

6. **Selectors — avoid the traps:**
   - Don't assert on nav that differs by viewport (a desktop sidebar is `hidden` on
     mobile and vice-versa). Assert on something in **both** layouts — usually the page
     `<h1>` via `getByRole("heading", { name: /.../i })`.
   - Use `{ exact: true }` for short button labels ("Save", "Add", "Enter") so "Save"
     doesn't also match "Saved".
   - Append `.first()` to OR-regex text locators (Playwright strict mode fails on >1
     match).
   - Don't assert on lazily-loaded / third-party widgets (maps, charts, Stripe elements,
     embeds). Assert adjacent app-rendered text/numbers instead.
   - shadcn/Radix `<Dialog>`/`<Select>`/`<Popover>` render in a **portal** — query by
     role (`getByRole("dialog")`, `getByRole("option")`); a shadcn `<Select>` is a button
     that opens a listbox, not a native `<select>`, so `selectOption` won't work — click
     the trigger, then click the option.
   - `await expect(locator).toBeVisible({ timeout: 15000 })` before clicking elements that
     appear after a route change or a Supabase round-trip (network latency on a hosted DB).

7. **Persistence is the point.** For every create/update/toggle a user can do: perform
   it, **reload the page**, and assert it's still there. That proves it wrote to Supabase,
   not just React state. On Supabase the #1 reason a create silently fails is an **RLS
   policy** blocking the insert — if a reload shows the item gone, check the table's
   row-level-security policies (`insert`/`select` for `auth.uid() = user_id`) before
   assuming the UI is broken.

8. **Serial journey, one shared account.** Use `test.describe.configure({ mode: "serial" })`
   and a single `page` created in `beforeAll`, so each step builds on the last (sign up
   once, then walk the app). Unique email per run:
   `e2e+journey-${Date.now()}@<a-domain-you-control>`.

9. **Watch CI from here and iterate.** After pushing, use the GitHub MCP tools
   (`mcp__github__actions_list` / `actions_get` / `get_job_logs` with
   `failed_only:true, return_content:true`) to read results. If a `list` result is huge
   and saved to a file, slice it with `python3 -c "print(open(F).read()[A:B])"` or use a
   sub-agent so it stays out of context. Read the exact failing `file:line`, locator, and
   error; fix precisely; push again. Expect 2–4 iterations — most failures are
   test-selector issues, not app bugs (say which in your commits).

10. **Commits:** set `git config user.email noreply@anthropic.com` and
    `user.name Claude` so they show verified.

11. **Mind the deploy↔CI race.** The E2E workflow and the app's own deploy run
    independently. If you change app/Supabase behavior the test depends on, make sure the
    **deploy finished** before the E2E run executes against it, or you'll chase ghosts.

## What to build (files)

- `playwright.config.ts` — `testDir: ./tests/e2e`; projects for **desktop** (Desktop
  Chrome) and **mobile** (Pixel 7); `use`: `baseURL: process.env.BASE_URL ||
  "<PROD_URL>"`, `reducedMotion: "reduce"`, `screenshot: "only-on-failure"`,
  `video: "retain-on-failure"`, `trace: "on-first-retry"`; `retries: process.env.CI ? 2 : 0`;
  reporter `[["github"],["html",{open:"never"}]]` on CI.

- `tests/e2e/smoke.spec.ts` — public surfaces, no auth, safe on prod anytime: home loads
  + title + hero `<h1>`; primary CTA routes; key sections render. (No app health endpoint
  by default on Supabase apps — assert the rendered page rather than inventing one.)

- `tests/e2e/journey.spec.ts` — THE full journey, serial, one account, auto-cleaned:
  1. Land on the landing/home → go to auth.
  2. **Sign up** through the real UI (Supabase email+password). Assert signed-in state
     (redirect to dashboard, account menu present, or "Sign in" gone).
  3–N. Visit **every screen/route** and perform **every interaction** a user can: create
     records (**assert persist across reload**), edits, toggles, filters, uploads, any
     AI/long-running action (bump that step's timeout, e.g. 30s), forms, settings.
     **Cover the full Step 0 inventory** — there should be roughly one journey step per
     route/feature you found; if a feature isn't represented, the journey is incomplete.
  Final: assert the **session survives a cold reload**, then **sign out**.
  `afterAll`: run the service-role purge (rule 5) to delete the test account + its rows.

- `tests/e2e/auth.spec.ts` (optional) — negative paths that create no account (bad-login
  error, validation messages).

- `scripts/purge-e2e-user.ts` — the service-role cleanup described in rule 5.

- `.github/workflows/e2e.yml` — on `push` to the default branch + `workflow_dispatch`
  (input `base_url`). Steps: checkout; setup-node 22 w/ npm cache; `npm ci`;
  `npx playwright install --with-deps chromium`;
  `npx playwright test --project=desktop --project=mobile` with env `BASE_URL`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (from repo secrets); always upload
  `playwright-report/` as an artifact.

- `tests/README.md` — how to run, the env knobs, the Supabase confirmation-toggle note,
  the porting recipe.

- `package.json` — `"test:e2e": "playwright test"`, `"test:e2e:ui": "playwright test --ui"`;
  add `@playwright/test` (+ `@supabase/supabase-js` if absent, for cleanup) to
  devDependencies. Gitignore `playwright-report/`, `test-results/`, `/playwright/.cache/`,
  and any `.env*`.

## Build / safety checks
- The tests import `@playwright/test`; make sure they're **excluded from the app `tsc`
  build** (don't add `tests/` to tsconfig includes) so the build is unaffected. Verify the
  app still builds.
- Verify `npx playwright test --list` enumerates all specs with no parse errors before
  pushing.
- **Never** put the service-role key in client code, the test page, or a commit — GitHub
  secret only, used solely in the Node cleanup step.

## Definition of done
A GitHub Actions E2E run on the default branch is **green**, having actually signed up a
new user and clicked through **every feature in your Step 0 inventory** on **both desktop
and mobile**, with persistence verified by reloads, and the test account cleaned up
afterward via service-role. Report the run number, the test count, the Step 0 inventory
the journey covered, and confirm the deployed app passed. State plainly that email
confirmation is disabled in Supabase (and how to restore it before launch).

## Supabase gotchas worth pre-empting
- **RLS** is the usual cause of a failed "persist across reload": the insert no-ops
  because a policy blocked it. Verify insert/select policies before blaming the UI.
- **Email rate limits / inbox**: with confirmation OFF you don't need an inbox; the
  unique `e2e+...@domain` address just needs to be on a domain you own so bounces don't
  hurt deliverability.
- **Edge Functions** deploy separately from the frontend — a green frontend deploy
  doesn't mean a function was updated; account for that timing.
- **Anon vs service-role**: the app/test browser uses the anon key (public, fine);
  cleanup uses service-role (secret, Node-only). Never cross them.
