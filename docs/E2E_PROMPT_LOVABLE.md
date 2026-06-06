# PROMPT: Add an end-to-end "real user does everything" test rig (Lovable + Supabase apps)

Paste this whole prompt into the AI assistant of a **Lovable** app (React/Vite +
Supabase). It sets up Playwright E2E tests that run a **real headless browser** through
the **entire new-user journey** (sign up → use every feature → verify persistence → sign
out) against the **deployed** site, in GitHub Actions, on every push.

> Read this whole prompt first. Several steps need **me (the human)** to flip a setting
> in the Supabase or GitHub dashboard — you cannot do those. Where that's true, STOP and
> tell me exactly what to click, then continue once I confirm.

---

## Read this first — how Lovable differs from a normal repo

- **Lovable syncs to GitHub.** The tests + CI workflow live in the connected GitHub repo
  and run in **GitHub Actions** — independent of Lovable's editor. If GitHub sync isn't
  on, tell me to enable it (Lovable → Settings → GitHub) before doing anything else.
- **You may not be able to run a browser or push from your environment.** Write the
  files; if you can't trigger CI yourself, tell me to commit/sync and watch the run, and
  give me the exact GitHub Actions URL/steps to read the result. (If you DO have git +
  GitHub access, drive it yourself and iterate to green.)
- **The backend is Supabase, not a Worker.** Auth, the database, and any serverless
  functions are Supabase. The verification toggle and the test-user cleanup are done the
  Supabase way (below), NOT via app code.

## Your task

Build a Playwright E2E rig that signs up a brand-new user and exercises **everything a
real user can do**, then runs it in CI with video/screenshot/trace proof. Iterate until a
CI run is actually **green** — don't claim success without a passing run.

## Hard rules (lessons that will save hours)

1. **Tests run against the DEPLOYED site** (the Lovable-published URL or custom domain),
   not a local dev server. Default `BASE_URL` to that URL; allow env override.

2. **CI runs the browser, not your sandbox.** Don't assume you can launch Chromium
   locally. Validate specs parse with `npx playwright test --list`; let GitHub Actions
   (which has Chromium) actually run them.

3. **DISABLE EMAIL CONFIRMATION for the test — this is a Supabase setting, not code.**
   A brand-new signup must reach the app immediately without clicking an email link.
   **STOP and tell me to do this:** Supabase Dashboard → **Authentication → Sign In /
   Providers → Email →** turn **"Confirm email" OFF** (or Auth → Providers depending on
   version). Without this, `supabase.auth.signUp()` returns a session-less user and the
   journey can't proceed. State clearly that I should re-enable it before real launch, or
   keep it off if the product intends instant access.
   - If I refuse to toggle it: fall back to creating the test user **pre-confirmed** via
     the Admin API in CI (service-role key + `auth.admin.createUser({ email, password,
     email_confirm: true })`), then sign in through the UI. Use this only if needed.

4. **Set `reducedMotion: "reduce"` in the Playwright config `use` block.** Framer-motion /
   CSS / shadcn animations keep elements "unstable" and make `.click()` time out. This
   collapses animations to instant and kills a whole class of flake. Ensure the app's CSS
   honors `@media (prefers-reduced-motion: reduce)` (Tailwind/shadcn usually do).

5. **Clean up the test user — via Supabase service-role, not app code.** Repeated CI runs
   must not pile up junk auth users + rows. Add a tiny cleanup that runs in CI
   `afterAll`, using the **service-role key** (NEVER the anon key, NEVER in client code):
   - Delete the auth user: `DELETE /auth/v1/admin/users/{id}` (or `auth.admin.deleteUser`).
   - Delete their app rows. If you have RLS with `user_id = auth.uid()`, a service-role
     client bypasses RLS — delete from each owned table by `user_id`.
   - The service-role key is a **GitHub Actions secret** (`SUPABASE_SERVICE_ROLE_KEY`) —
     tell me to add it (GitHub → repo → Settings → Secrets → Actions). Never commit it.
   - Cleanest form: a `scripts/purge-e2e-user.ts` invoked from the spec's `afterAll`, or a
     Supabase Edge Function `purge-test-user` guarded by a shared secret.

6. **Selectors — avoid these traps:**
   - Don't assert on nav that differs by viewport (desktop sidebar `hidden` on mobile,
     mobile bottom-bar hidden on desktop). Assert on something in **both** layouts —
     usually the page `<h1>` via `getByRole("heading", { name: /.../i })`.
   - `{ exact: true }` for short labels so "Save" ≠ "Saved", "Enter" ≠ "Entered".
   - `.first()` on OR-regex text locators (strict mode fails on >1 match).
   - Don't assert on lazy/third-party widgets (maps, charts, embeds). Assert adjacent
     app-rendered text/numbers.
   - `await expect(locator).toBeVisible({ timeout: 15000 })` before clicking elements that
     appear after navigation, an auth round-trip, or a Supabase fetch (network latency).
   - shadcn `<Dialog>`/`<Select>` render in a portal — query by role
     (`getByRole("dialog")`, `getByRole("option")`), and remember a `<Select>` is a button
     that opens a listbox, not a native `<select>`.

7. **Persistence is the point.** For every create/update a user can do: perform it,
   **reload the page**, assert it's still there. This proves it wrote to Supabase, not
   just React/local state — the #1 thing that catches "looks like it works but saves
   nothing" (RLS policy blocking the insert, wrong table, optimistic-only UI).

8. **Serial journey, one shared account.** `test.describe.configure({ mode: "serial" })`
   + a single `page` from `beforeAll`. Unique email per run:
   `e2e+journey-${Date.now()}@<your-domain>` (use a domain you control / a Supabase test
   inbox; avoid real third-party inboxes).

9. **Watch CI and iterate.** Read failures from the Actions run (the HTML report +
   video + trace are uploaded as an artifact). Fix the exact failing `file:line`/locator,
   re-push. Expect 2–4 iterations; most failures are test-selector issues, not app bugs.

## What to build (files committed to the GitHub repo)

- `playwright.config.ts` — `testDir: ./tests/e2e`; **desktop** (Desktop Chrome) +
  **mobile** (Pixel 7) projects; `use`: `baseURL: process.env.BASE_URL ||
  "<PUBLISHED_URL>"`, `reducedMotion: "reduce"`, `screenshot: "only-on-failure"`,
  `video: "retain-on-failure"`, `trace: "on-first-retry"`; `retries: process.env.CI ? 2 : 0`;
  CI reporter `[["github"],["html",{open:"never"}]]`.

- `tests/e2e/smoke.spec.ts` — no-auth public surfaces: home loads, title, hero `<h1>`,
  primary CTA routes, key sections render. (Supabase has no app health endpoint by
  default; assert on the rendered marketing page instead.)

- `tests/e2e/journey.spec.ts` — THE journey, serial, one account, auto-cleaned:
  1. Land on the home/landing page → go to the app/auth.
  2. **Sign up** through the real UI (Supabase email+password form). Assert signed-in
     state (e.g. redirect to the dashboard, account menu appears, "Sign in" gone).
  3–N. Visit **every screen/route** and perform **every interaction**: create records
     (**assert persist across reload**), edits, toggles, filters, uploads, any
     long-running/AI action (bump that step's timeout ~30s), forms, settings. Enumerate
     the real features from the app's routes/components — cover all of them.
  Final: assert **session survives a cold reload**, then **sign out**.
  `afterAll`: purge the test user via the service-role cleanup (#5).

- `tests/e2e/auth.spec.ts` (optional) — negative paths that create no account (bad-login
  error, validation messages).

- `.github/workflows/e2e.yml` — on `push` to the default branch + `workflow_dispatch`
  (input `base_url`). Steps: checkout; setup-node 22 + npm cache; `npm ci`;
  `npx playwright install --with-deps chromium`;
  `npx playwright test --project=desktop --project=mobile` with env `BASE_URL`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (all from repo secrets); always upload
  `playwright-report/`. **Tell me which secrets to add** in GitHub.

- `tests/README.md` — run instructions, env knobs, the verification-toggle note, porting
  recipe.

- `package.json` — `"test:e2e": "playwright test"`, `"test:e2e:ui": "playwright test --ui"`;
  add `@playwright/test` (and `@supabase/supabase-js` if not already present, for the
  cleanup) to devDependencies. Gitignore `playwright-report/`, `test-results/`,
  `/playwright/.cache/`, and any `.env*` holding keys.

## Safety checks
- Make sure the test files don't break the app's build/typecheck — Lovable apps build
  with Vite/tsc; keep `tests/` out of the app `tsconfig` includes if it complains, and
  verify the build still passes.
- `npx playwright test --list` must enumerate all specs with no parse errors before you
  consider pushing.
- **Never** put the service-role key in client code or commit it — secrets only.

## Definition of done
A GitHub Actions E2E run on the default branch is **green**, having actually signed up a
new user and clicked through every feature on **both desktop and mobile**, with
persistence verified by reloads, and the test user cleaned up afterward. Report the run
number, test count, and confirm the deployed app passed. State plainly that email
confirmation is disabled in Supabase (and that I should re-enable it before launch if the
product needs it).

---

## ⚠️ Honest caveats about Lovable specifically
- **If GitHub sync is off, none of this works** — the workflow has nowhere to run. That's
  the first thing to confirm.
- **Lovable's own preview/sandbox can't run Playwright.** Everything executes in GitHub
  Actions. If the assistant inside Lovable can't reach GitHub Actions logs, the human
  reads the run and pastes failures back.
- **Supabase RLS is the usual culprit** when "persist across reload" fails: the insert
  silently no-ops because a policy blocked it. If a create step doesn't persist, check
  the table's RLS policies (insert/select for `auth.uid() = user_id`) before assuming the
  UI is broken.
- **Edge Functions** (if the app uses them) deploy separately from the frontend — a green
  frontend deploy doesn't guarantee the function is updated. Account for that timing.
