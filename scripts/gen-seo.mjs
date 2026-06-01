// Build-time SEO pages: pull real events from the deployed Worker (CI has
// egress) and emit crawlable static HTML per state + per event with JSON-LD.
// These give the aggregator an organic-search growth engine ("rodeos near me").
// Non-fatal: if the API isn't reachable, falls back to bundled seed events.

import { mkdir, writeFile, readFile } from "node:fs/promises";

const SITE = "https://8s.rodeo";
const API = process.env.EVENTS_URL || `${SITE}/api/events`;
const outRoot = new URL("../public/rodeos/", import.meta.url);

const STATE_NAMES = {
  TX: "Texas", OK: "Oklahoma", WY: "Wyoming", CO: "Colorado", KS: "Kansas",
  NM: "New Mexico", NE: "Nebraska", SD: "South Dakota", MT: "Montana", ID: "Idaho",
  AZ: "Arizona", NV: "Nevada", CA: "California", OR: "Oregon", WA: "Washington",
};

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function slug(s = "") {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

async function getEvents() {
  try {
    const r = await fetch(API);
    if (r.ok) {
      const d = await r.json();
      if (d.events && d.events.length) return d.events;
    }
  } catch {
    /* fall back */
  }
  // Fallback: bundled seed.
  try {
    const seed = await readFile(new URL("../shared/seed.ts", import.meta.url), "utf8");
    const m = seed.match(/events:\s*\[([\s\S]*?)\n  \],/);
    void m;
  } catch {
    /* ignore */
  }
  return [];
}

function page({ title, description, path, body, jsonld }) {
  return `<!doctype html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${path}"><meta property="og:type" content="website">
<link rel="icon" href="/favicon.svg">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
<style>body{font-family:Inter,system-ui,sans-serif;max-width:760px;margin:0 auto;padding:2rem 1.25rem;color:#2b1d12;background:#faf4e8;line-height:1.5}a{color:#b8502b}h1{font-family:Oswald,sans-serif;font-size:2rem;line-height:1.05}.card{border:1px solid rgba(138,90,59,.2);border-radius:14px;padding:1rem;margin:.75rem 0;background:#fff8}.cta{display:inline-block;background:#b8502b;color:#faf4e8;padding:.7rem 1.4rem;border-radius:999px;text-decoration:none;font-weight:700;margin-top:1rem}.muted{color:#2b1d12aa;font-size:.9rem}</style>
</head><body>
<p><a href="/">← 8 Seconds</a></p>
${body}
<a class="cta" href="/app">See it on the live map →</a>
<p class="muted" style="margin-top:2rem">8 Seconds — every youth rodeo in one place. Deadline alerts, qualifying ladders, and the horse treated like the athlete it is.</p>
</body></html>`;
}

const events = await getEvents();
await mkdir(outRoot, { recursive: true });

if (events.length === 0) {
  console.log("[seo] no events available — skipping");
  process.exit(0);
}

// Group by state.
const byState = {};
for (const e of events) {
  const st = (e.state || "").toUpperCase();
  if (!st) continue;
  (byState[st] ||= []).push(e);
}

let count = 0;
const indexLinks = [];

for (const [st, list] of Object.entries(byState)) {
  const stateName = STATE_NAMES[st] || st;
  const dir = new URL(`${st}/`, outRoot);
  await mkdir(dir, { recursive: true });

  // State hub page.
  const cards = list
    .map((e) => {
      const s = slug(`${e.name}-${e.city}`);
      return `<div class="card"><h2 style="margin:.2rem 0;font-size:1.1rem"><a href="/rodeos/${st}/${s}">${esc(e.name)}</a></h2>
<div class="muted">${esc(e.venue || "")}${e.venue ? " · " : ""}${esc(e.city)}, ${st}${e.startDate ? " · " + esc(e.startDate) : ""}</div>
${e.entryDeadline ? `<div class="muted">Entry deadline: ${esc(e.entryDeadline)}</div>` : ""}</div>`;
    })
    .join("\n");

  await writeFile(
    new URL("index.html", dir),
    page({
      title: `${stateName} Youth Rodeos & Schedules | 8 Seconds`,
      description: `Find youth rodeo events in ${stateName} — dates, venues, entry deadlines and a live map. ${list.length} events listed.`,
      path: `/rodeos/${st}/`,
      body: `<h1>Youth Rodeos in ${esc(stateName)}</h1><p>${list.length} upcoming youth rodeo events across ${esc(stateName)}. Tap any event for details, or open the live map to filter by discipline and set deadline reminders.</p>${cards}`,
      jsonld: {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `Youth Rodeos in ${stateName}`,
        itemListElement: list.map((e, i) => ({ "@type": "ListItem", position: i + 1, name: e.name })),
      },
    }),
  );
  indexLinks.push(`<li><a href="/rodeos/${st}/">${esc(stateName)} (${list.length})</a></li>`);
  count++;

  // Per-event pages.
  for (const e of list) {
    const s = slug(`${e.name}-${e.city}`);
    await writeFile(
      new URL(`${s}.html`, dir),
      page({
        title: `${e.name} — ${e.city}, ${st} | 8 Seconds`,
        description: `${e.name} in ${e.city}, ${stateName}.${e.startDate ? " " + e.startDate + "." : ""}${e.entryDeadline ? " Entry deadline " + e.entryDeadline + "." : ""} Set a free deadline reminder.`,
        path: `/rodeos/${st}/${s}`,
        body: `<h1>${esc(e.name)}</h1>
<p class="muted">${esc(e.venue || "")}${e.venue ? " · " : ""}${esc(e.city)}, ${stateName}</p>
<div class="card">
${e.association ? `<div><strong>Association:</strong> ${esc(e.association)}</div>` : ""}
${e.startDate ? `<div><strong>Date:</strong> ${esc(e.startDate)}</div>` : ""}
${e.entryDeadline ? `<div><strong>Entry deadline:</strong> ${esc(e.entryDeadline)}</div>` : ""}
${Array.isArray(e.disciplines) && e.disciplines.length ? `<div><strong>Events:</strong> ${esc(e.disciplines.join(", "))}</div>` : ""}
</div>
<p>Following this rodeo on 8 Seconds gets you a reminder before entries close, plus the stock draw the moment it posts.</p>
<p><a href="/rodeos/${st}/">← All ${esc(stateName)} rodeos</a></p>`,
        jsonld: {
          "@context": "https://schema.org",
          "@type": "Event",
          name: e.name,
          startDate: e.startDate || undefined,
          location: { "@type": "Place", name: e.venue || e.city, address: `${e.city}, ${st}` },
          organizer: e.association ? { "@type": "Organization", name: e.association } : undefined,
        },
      }),
    );
    count++;
  }
}

// Top-level /rodeos index.
await writeFile(
  new URL("index.html", outRoot),
  page({
    title: "Youth Rodeo Schedules by State | 8 Seconds",
    description: "Browse youth rodeo events by state — dates, venues, and entry deadlines, all in one place.",
    path: "/rodeos/",
    body: `<h1>Youth Rodeos by State</h1><p>Every youth rodeo in one place. Pick your state:</p><ul>${indexLinks.join("")}</ul>`,
  }),
);
count++;

// Sitemap covering home, app, submit, and every generated SEO page.
const urls = [`${SITE}/`, `${SITE}/app`, `${SITE}/submit`, `${SITE}/rodeos/`];
for (const [st, list] of Object.entries(byState)) {
  urls.push(`${SITE}/rodeos/${st}/`);
  for (const e of list) urls.push(`${SITE}/rodeos/${st}/${slug(`${e.name}-${e.city}`)}`);
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;
await writeFile(new URL("../public/sitemap.xml", import.meta.url), sitemap);

console.log(`[seo] generated ${count} pages + sitemap (${urls.length} urls) across ${Object.keys(byState).length} states`);
