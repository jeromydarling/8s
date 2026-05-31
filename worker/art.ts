import type { Context } from "hono";
import type { Env } from "./index";

// Vintage-American-watercolor art for the marketing site. Uses Cloudflare AI
// (SDXL-Lightning, which honors a negative prompt so we can push hard away from
// photorealism) and always falls back to a crafted layered watercolor SVG so the
// page is beautiful before AI warms up. A nod to the Great American West.

// Bump to invalidate every cached image (edge + R2) after a prompt/style change.
const ART_VERSION = "4";

const STYLE =
  "vintage American watercolor illustration, hand painted on cotton rag paper, loose wet-on-wet washes, visible paper grain and paint bleed, soft feathered edges, muted dusty antique palette of ochre sienna sage and faded indigo, early 1900s western travel-poster feeling, painterly and flat, gentle and nostalgic";

const NEGATIVE =
  "photograph, photo, photorealistic, realistic, hyperrealistic, 3d render, cgi, octane, dslr, sharp focus, depth of field, hdr, glossy, plastic, lens flare, neon, text, words, letters, watermark, signature, frame, border, " +
  "extra legs, extra limbs, two heads, multiple heads, duplicated horse, multiple horses, crowd, deformed, mutated, fused, distorted anatomy, malformed, blurry faces, melted faces";

interface Preset {
  scene: string;
  palette: [string, string, string, string, string]; // sky-top, sky-mid, far, mid, near
  sun: string;
  silhouette?: "rider" | "horse" | "fence";
}

const PRESETS: Record<string, Preset> = {
  hero: {
    scene:
      "a wide open West Texas valley at golden hour with a distant mesa, dry rolling grassland and an enormous soft sky, lots of open space, no people",
    palette: ["#f4e3c4", "#f0cfa0", "#d99c6a", "#b06b4a", "#7c4a35"],
    sun: "#fbe3b3",
  },
  rider: {
    scene:
      "one cowgirl on a single horse rounding one barrel in an empty rodeo arena, side view, dust kicking up, warm dusk light, lots of clean empty background, simple composition, only one horse, no crowd, no spectators",
    palette: ["#f6e7cb", "#f2c98f", "#d98e63", "#9c5a44", "#5e3829"],
    sun: "#f9d79e",
    silhouette: "rider",
  },
  horse: {
    scene:
      "a single quarter horse standing in a ranch corral at sunrise, a weathered wooden fence behind, calm and proud",
    palette: ["#eef0df", "#e6d9b0", "#c9a878", "#8f7350", "#5b4a32"],
    sun: "#f3ead0",
    silhouette: "horse",
  },
  arena: {
    scene:
      "an empty small town rodeo arena at dusk, a weathered wooden fence in the foreground and quiet grandstands, prairie and big sky behind, no people, no animals, calm and still",
    palette: ["#e9dcc2", "#e0c190", "#c98f63", "#7e5640", "#3f2c20"],
    sun: "#f6d9a0",
    silhouette: "fence",
  },
  community: {
    scene:
      "one cowboy standing beside his single saddled horse at a wooden hitching rail at golden hour, quiet companionship, simple composition, only one horse and one person, no crowd",
    palette: ["#f3e6cf", "#efc98f", "#dd9a62", "#a3654a", "#5d3a2b"],
    sun: "#fbe0ad",
    silhouette: "horse",
  },
  trail: {
    scene:
      "an open prairie trail under a vast sky with drifting clouds, sage brush and warm sand, expansive and quiet",
    palette: ["#eef2e6", "#e7d6ad", "#cdb07f", "#9aa06a", "#5f6b42"],
    sun: "#f5eccf",
    silhouette: "fence",
  },
  // A clear, prominent rodeo horse for the marketing page.
  barrelracer: {
    scene:
      "one cowgirl on a single sorrel horse rounding one barrel at a full run, side profile, mane and dirt flying, empty rodeo arena behind, golden late-afternoon light, simple clean composition, only one horse, no crowd, no spectators, no extra legs",
    palette: ["#f6e6c6", "#eec487", "#d6905f", "#a85f41", "#5e3727"],
    sun: "#f9d79e",
    silhouette: "rider",
  },
};

export async function generateArt(c: Context<{ Bindings: Env }>, slug: string): Promise<Response> {
  const preset = PRESETS[slug] ?? PRESETS.hero;
  const cache = caches.default;
  const cacheKey = new Request(new URL(c.req.url).toString());
  const key = `art/v${ART_VERSION}/${slug}.png`;

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const serve = (body: BodyInit, type = "image/png", maxAge = 31536000) => {
    const resp = new Response(body, {
      headers: { "Content-Type": type, "Cache-Control": `public, max-age=${maxAge}` },
    });
    c.executionCtx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  };

  // 1) Curated override committed to public/art/<slug>.jpg always wins.
  try {
    const origin = new URL(c.req.url).origin;
    const curated = await c.env.ASSETS.fetch(new Request(`${origin}/art/${slug}.jpg`));
    if (curated.ok && (curated.headers.get("content-type") ?? "").startsWith("image")) {
      return serve(curated.body!, "image/jpeg", 86400);
    }
  } catch {
    /* none — continue */
  }

  // 2) R2 persistent cache (survives deploys).
  if (c.env.MEDIA) {
    const obj = await c.env.MEDIA.get(key).catch(() => null);
    if (obj) return serve(obj.body, "image/png");
  }

  // 3) Generate with Workers AI (SDXL-Lightning + negative prompt).
  if (c.env.AI) {
    try {
      const stream = (await c.env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", {
        prompt: `${preset.scene}. ${STYLE}`,
        negative_prompt: NEGATIVE,
        num_steps: 20,
        guidance: 7,
        width: 1280,
        height: 768,
      })) as ReadableStream;
      const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      if (bytes.byteLength > 0) {
        if (c.env.MEDIA) {
          c.executionCtx.waitUntil(
            c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "image/png" } }).then(() => undefined),
          );
        }
        return serve(bytes);
      }
    } catch (err) {
      console.error("AI art generation failed, serving SVG", err);
    }
  }

  // 4) Crafted watercolor SVG fallback.
  return serve(watercolorSvg(preset, slug), "image/svg+xml; charset=utf-8", 86400);
}

function watercolorSvg(p: Preset, seed: string): string {
  const W = 1600;
  const H = 1000;
  const s = hash(seed);
  const sunX = 380 + (s % 400);
  const sunY = 300 + ((s >> 3) % 120);

  const silhouette = renderSilhouette(p.silhouette, W, H);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.palette[0]}"/>
      <stop offset="55%" stop-color="${p.palette[1]}"/>
      <stop offset="100%" stop-color="${p.palette[2]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="${(sunX / W) * 100}%" cy="${(sunY / H) * 100}%" r="60%">
      <stop offset="0%" stop-color="${p.sun}" stop-opacity="0.95"/>
      <stop offset="40%" stop-color="${p.sun}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${p.sun}" stop-opacity="0"/>
    </radialGradient>
    <filter id="paper">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${s % 97}" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>
    <filter id="bleed" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
    <filter id="wash" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="${(s >> 2) % 50}" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="38"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="${sunX}" cy="${sunY}" r="120" fill="${p.sun}" opacity="0.9" filter="url(#bleed)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <g filter="url(#wash)" opacity="0.96">
    <path d="M0 ${H * 0.62} ${hills(W, H * 0.62, 5, s)} L${W} ${H} L0 ${H} Z" fill="${p.palette[2]}" opacity="0.75"/>
    <path d="M0 ${H * 0.72} ${hills(W, H * 0.72, 4, s + 7)} L${W} ${H} L0 ${H} Z" fill="${p.palette[3]}" opacity="0.85"/>
    <path d="M0 ${H * 0.84} ${hills(W, H * 0.84, 6, s + 19)} L${W} ${H} L0 ${H} Z" fill="${p.palette[4]}"/>
  </g>

  ${silhouette}

  <rect width="${W}" height="${H}" filter="url(#paper)" opacity="0.6"/>
</svg>`;
}

function hills(w: number, baseY: number, segments: number, seed: number): string {
  let d = "";
  const step = w / segments;
  for (let i = 1; i <= segments; i++) {
    const x = i * step;
    const cx = x - step / 2;
    const cy = baseY + (((seed * (i + 3)) % 70) - 35);
    d += ` Q${cx.toFixed(0)} ${cy.toFixed(0)} ${x.toFixed(0)} ${(baseY + (((seed * i) % 30) - 15)).toFixed(0)}`;
  }
  return d;
}

function renderSilhouette(kind: Preset["silhouette"], W: number, H: number): string {
  const y = H * 0.84;
  if (kind === "fence") {
    let posts = "";
    for (let i = 0; i < 9; i++) {
      const x = 120 + i * ((W - 240) / 8);
      posts += `<rect x="${x}" y="${y - 90}" width="10" height="95" fill="#2c1d12" opacity="0.55"/>`;
    }
    return `<g opacity="0.6"><line x1="120" y1="${y - 70}" x2="${W - 120}" y2="${y - 70}" stroke="#2c1d12" stroke-width="3"/><line x1="120" y1="${y - 40}" x2="${W - 120}" y2="${y - 40}" stroke="#2c1d12" stroke-width="3"/>${posts}</g>`;
  }
  if (kind === "horse") {
    return `<g transform="translate(${W * 0.6} ${y - 150}) scale(2.1)" fill="#241710" opacity="0.72">
      <path d="M8 64 q3 -20 14 -26 q1 -7 -2 -12 q6 1 9 8 q7 -3 16 -2 q9 -10 14 -8 q-1 6 -6 9 q5 1 9 6 q6 -1 9 3 q-5 3 -10 1 q3 11 -1 25 l-6 0 q2 -12 -2 -20 q-8 5 -20 5 l-2 0 q1 10 -2 18 l-6 0 q-1 -10 1 -18 q-9 -3 -14 -10 q-3 13 -2 22 l-6 0 q-2 -15 1 -29 z"/>
    </g>`;
  }
  if (kind === "rider") {
    // galloping horse + rider, leaning into a turn
    return `<g transform="translate(${W * 0.52} ${y - 200}) scale(2.3)" fill="#1f140d" opacity="0.75">
      <path d="M2 70 q4 -10 12 -12 q-4 -8 -2 -16 q5 4 7 11 q8 -4 18 -3 q10 -12 17 -10 q-1 6 -7 10 q6 0 11 5 q7 -2 11 3 q-5 3 -11 2 q4 9 12 12 q-2 4 -9 2 q-6 -2 -10 -7 q1 9 -3 17 l-6 0 q3 -10 -1 -18 q-9 4 -21 3 q5 7 4 16 l-6 1 q0 -9 -5 -15 q-6 6 -7 15 l-6 0 q0 -11 7 -18 q-9 -2 -13 -9 z"/>
      <path d="M28 36 q3 -10 11 -11 q4 -10 12 -8 q-2 6 -7 8 q5 3 6 11 q-5 -3 -10 -2 q-4 4 -10 4 z"/>
      <circle cx="46" cy="26" r="4.5"/>
    </g>`;
  }
  return "";
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
