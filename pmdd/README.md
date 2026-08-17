# GLORY — PMDD Protocol Tracker

"A return to glory." Installable PWA (Add to Home Screen shows it as GLORY)
with light/night themes — auto by default, manual toggle in the top bar.

Standalone Cloudflare Worker app (separate from the 8s rodeo Worker): a daily
tracker for a cycle-anchored PMDD protocol — LifeWave patches (Y-Age Aeon /
Glutathione / Carnosine + SP6 Complete in the luteal phase), Elix Cycle
Balance, and vitamin D3+K2.

- **Today** — the day's patches (with placement sites), doses, check-off.
- **Check-in** — mood / energy / sleep / cravings / pain (1–5) + diet notes.
- **Trends** — per-metric sparklines with luteal days shaded, plus a table view.
- **Cycle** — log a period start; everything (including the subscribed
  calendar) re-anchors to it. Median of recent cycles refines the length.
- **Supplies** — dose-level inventory from the check-offs, runout projection,
  reorder pills.
- **Journal** — free-form daily entries; Workers AI (binding `AI`, model
  llama-3.1-8b-instruct) retells them on demand as "the story so far," a warm
  second-person narrative with cycle context. No AI binding → entries still
  work, story degrades politely.
- **Avoid list** — foods/drinks that make things worse (avoid-only by design).
  Managed on Check-in, surfaced read-only on Today.
- **/calendar.ics** — live iCal feed (subscribe from Google/Apple Calendar):
  morning/evening patch events, phase changes, expected period, reorder alerts.

Local dev in a sandbox without Cloudflare credentials: use
`npx wrangler dev --config wrangler.local.jsonc` (same config minus the AI
binding, which otherwise demands a remote proxy session).

## Deploy

```sh
cd pmdd
npm install
npm run db:create                 # paste the printed id into wrangler.jsonc
npm run db:schema:remote          # tables + seed (anchor 2026-08-07, supplies)
npx wrangler secret put ACCESS_KEY   # long random string; all routes 503 until set
npm run deploy
```

Then share `https://<worker-url>/?k=<ACCESS_KEY>` with the client (it sets a
year-long cookie), and subscribe to `https://<worker-url>/calendar.ics?k=<ACCESS_KEY>`.

Local dev: `npx wrangler dev` (worker, port 8787) + `npm run dev` (Vite, proxies
`/api`). Apply the schema locally first with `npm run db:schema:local`.

## Notes

- Auth is a single shared-link key: fine for one client + practitioner; rotate
  by re-running `wrangler secret put ACCESS_KEY`. It fails closed when unset.
- The Workers Build for the 8s repo deploys the rodeo app only; deploy this one
  manually from `pmdd/` (or add a second Workers Build with root dir `pmdd`).
- Google refreshes subscribed calendars on its own schedule (commonly every
  6–24 h). The app itself is always current; the feed carries a 6 h TTL hint.
- This supports, not replaces, clinical care for PMDD. Both patch and herb
  vendors direct users with health conditions to a health professional.
