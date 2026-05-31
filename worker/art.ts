import type { Context } from "hono";
import type { Env } from "./index";

// Watercolor art for the marketing site. Prefers Cloudflare AI (FLUX) for true
// painterly imagery; always falls back to a crafted, layered watercolor SVG so
// the page is beautiful even before AI is enabled. A nod to the Great American
// West — muted, warm, never garish.

interface Preset {
  prompt: string;
  palette: [string, string, string, string, string]; // sky-top, sky-mid, far, mid, near
  sun: string;
  silhouette?: "rider" | "horse" | "fence";
}

const PRESETS: Record<string, Preset> = {
  hero: {
    prompt:
      "loose watercolor painting of a wide open West Texas valley at golden hour, distant mesa, dry grass, soft washes, muted ochre and dusty sage, lots of negative space, no people, no text",
    palette: ["#f4e3c4", "#f0cfa0", "#d99c6a", "#b06b4a", "#7c4a35"],
    sun: "#fbe3b3",
  },
  rider: {
    prompt:
      "minimal watercolor of a lone barrel racer and horse silhouette against a warm dusk sky, soft bleeding edges, dusty rose and amber, no text",
    palette: ["#f6e7cb", "#f2c98f", "#d98e63", "#9c5a44", "#5e3829"],
    sun: "#f9d79e",
    silhouette: "rider",
  },
  horse: {
    prompt:
      "watercolor study of a quarter horse grazing at sunrise, sage and cream tones, soft washes, no text",
    palette: ["#eef0df", "#e6d9b0", "#c9a878", "#8f7350", "#5b4a32"],
    sun: "#f3ead0",
    silhouette: "horse",
  },
  arena: {
    prompt:
      "watercolor of a small town rodeo arena at dusk, wooden fence, stadium lights warming up, prairie behind, muted nostalgic palette, no text",
    palette: ["#e9dcc2", "#e0c190", "#c98f63", "#7e5640", "#3f2c20"],
    sun: "#f6d9a0",
    silhouette: "fence",
  },
  community: {
    prompt:
      "watercolor of families gathered at a country fairground in the evening, warm lantern light, sense of belonging, soft and tender, no text",
    palette: ["#f3e6cf", "#efc98f", "#dd9a62", "#a3654a", "#5d3a2b"],
    sun: "#fbe0ad",
  },
  trail: {
    prompt:
      "watercolor of an open prairie trail under a big sky with drifting clouds, sage green and warm sand, expansive, no text",
    palette: ["#eef2e6", "#e7d6ad", "#cdb07f", "#9aa06a", "#5f6b42"],
    sun: "#f5eccf",
    silhouette: "fence",
  },
};

export async function generateArt(c: Context<{ Bindings: Env }>, slug: string): Promise<Response> {
  const preset = PRESETS[slug] ?? PRESETS.hero;
  const cache = caches.default;
  const cacheKey = new Request(new URL(c.req.url).toString());

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // Try R2 cache (persistent across deploys) then AI generation.
  if (c.env.MEDIA) {
    const obj = await c.env.MEDIA.get(`art/${slug}.jpg`).catch(() => null);
    if (obj) {
      const resp = new Response(obj.body, {
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
      });
      c.executionCtx.waitUntil(cache.put(cacheKey, resp.clone()));
      return resp;
    }
  }

  if (c.env.AI) {
    try {
      const out = (await c.env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
        prompt: preset.prompt,
        steps: 6,
      })) as { image?: string };
      if (out.image) {
        const bytes = Uint8Array.from(atob(out.image), (ch) => ch.charCodeAt(0));
        if (c.env.MEDIA) {
          c.executionCtx.waitUntil(
            c.env.MEDIA.put(`art/${slug}.jpg`, bytes, {
              httpMetadata: { contentType: "image/jpeg" },
            }).then(() => undefined),
          );
        }
        const resp = new Response(bytes, {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
        c.executionCtx.waitUntil(cache.put(cacheKey, resp.clone()));
        return resp;
      }
    } catch (err) {
      console.error("AI art generation failed, serving SVG", err);
    }
  }

  const svg = watercolorSvg(preset, slug);
  const resp = new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
  c.executionCtx.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
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
    return `<g transform="translate(${W * 0.62} ${y - 150}) scale(1.7)" fill="#241710" opacity="0.7">
      <path d="M10 60 q5 -30 25 -34 q6 -14 18 -10 q-2 8 -8 10 q14 2 26 10 q10 -2 16 4 q-6 4 -14 2 q4 14 -2 30 l-6 0 q2 -14 -2 -24 q-10 6 -24 6 q2 12 -2 22 l-6 0 q-2 -12 0 -22 q-12 -2 -18 -10 q-2 14 -2 22 l-6 0 q-2 -16 0 -28 z"/>
    </g>`;
  }
  if (kind === "rider") {
    return `<g transform="translate(${W * 0.58} ${y - 175}) scale(1.9)" fill="#1f140d" opacity="0.72">
      <path d="M6 70 q4 -26 22 -30 q4 -16 16 -16 q8 0 8 8 q0 6 -6 8 q10 2 18 10 q9 -3 15 3 q-5 4 -12 3 q4 12 0 26 l-5 0 q2 -12 -1 -21 q-9 5 -21 5 q1 11 -2 20 l-6 0 q-1 -11 1 -20 q-11 -2 -17 -9 q-2 12 -1 20 l-6 0 q-2 -14 -2 -25 z"/>
      <circle cx="40" cy="20" r="5"/><path d="M33 18 q7 -8 14 0 z"/>
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
