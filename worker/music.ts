import type { Context } from "hono";
import type { Env } from "./index";

// Background music for the demo video. Tries, in order: R2 cache -> committed
// static asset -> Workers AI generation (minimax/music-2.6). Returns 204 if none
// yield audio, so the video still plays (silent). /api/music?debug=1 always
// returns JSON describing exactly what happened at each step.

const VERSION = "1";
const KEY = `audio/tour-music-v${VERSION}.mp3`;
const PROMPT =
  "Warm instrumental country Americana: gentle fingerpicked acoustic guitar, soft pedal steel, light brushed drums and upright bass, hopeful and heartfelt, wide open Western feeling, mid-tempo, no vocals.";

export async function musicStatus(c: Context<{ Bindings: Env }>): Promise<Response> {
  let available = false;
  if (c.env.MEDIA) available = !!(await c.env.MEDIA.head(KEY).catch(() => null));
  if (!available) {
    const origin = new URL(c.req.url).origin;
    const head = await c.env.ASSETS.fetch(
      new Request(`${origin}/audio/tour-music.mp3`, { method: "HEAD" }),
    ).catch(() => null);
    available = !!head?.ok;
  }
  // Only claim available when a real cached/committed file exists. AI generation
  // is attempted lazily but is not guaranteed, so don't promise it here.
  return c.json({ available });
}

async function tryGenerate(
  env: Env,
): Promise<{ bytes: Uint8Array | null; info: Record<string, unknown> }> {
  if (!env.AI) return { bytes: null, info: { reason: "no AI binding" } };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 50_000);
  try {
    const out = (await env.AI.run(
      "minimax/music-2.6",
      {
        is_instrumental: true,
        lyrics_optimizer: false,
        prompt: PROMPT,
        format: "mp3",
        sample_rate: 44100,
      } as Record<string, unknown>,
      { signal: ac.signal } as unknown as Record<string, unknown>,
    )) as { audio?: string } | string | ArrayBuffer | ReadableStream;

    let bytes: Uint8Array | null = null;
    let shape = "unknown";
    if (out instanceof ReadableStream) {
      shape = "stream";
      bytes = new Uint8Array(await new Response(out).arrayBuffer());
    } else if (out instanceof ArrayBuffer) {
      shape = "arraybuffer";
      bytes = new Uint8Array(out);
    } else if (typeof out === "object" && out && "audio" in out && out.audio) {
      const a = out.audio;
      if (a.startsWith("http")) {
        shape = "url";
        const r = await fetch(a);
        if (r.ok) bytes = new Uint8Array(await r.arrayBuffer());
      } else {
        shape = "base64";
        bytes = Uint8Array.from(atob(a), (ch) => ch.charCodeAt(0));
      }
    }
    return {
      bytes,
      info: {
        shape,
        bytes: bytes?.byteLength ?? 0,
        keys: typeof out === "object" && out ? Object.keys(out) : typeof out,
      },
    };
  } catch (err) {
    return { bytes: null, info: { error: String(err) } };
  } finally {
    clearTimeout(timer);
  }
}

export async function music(c: Context<{ Bindings: Env }>): Promise<Response> {
  const debug = c.req.query("debug") === "1";
  const steps: Record<string, unknown> = { hasAI: !!c.env.AI, hasMedia: !!c.env.MEDIA };

  const cache = caches.default;
  const cacheKey = new Request(new URL(c.req.url).origin + "/api/music"); // ignore ?debug
  if (!debug) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const serve = (body: BodyInit) => {
    const resp = new Response(body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000" },
    });
    c.executionCtx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  };

  // 1) R2 cache.
  if (c.env.MEDIA) {
    const obj = await c.env.MEDIA.get(KEY).catch(() => null);
    steps.r2Hit = !!obj;
    if (obj && !debug) return serve(obj.body);
  }

  // 2) Committed static asset.
  const origin = new URL(c.req.url).origin;
  const asset = await c.env.ASSETS.fetch(new Request(`${origin}/audio/tour-music.mp3`)).catch(() => null);
  steps.assetHit = !!asset?.ok;
  if (asset?.ok && !debug) return serve(asset.body!);

  // 3) Generate with Workers AI.
  const gen = await tryGenerate(c.env);
  steps.generate = gen.info;

  if (gen.bytes && gen.bytes.byteLength > 1024) {
    if (c.env.MEDIA) {
      c.executionCtx.waitUntil(
        c.env.MEDIA.put(KEY, gen.bytes, { httpMetadata: { contentType: "audio/mpeg" } }).then(() => undefined),
      );
    }
    if (debug) return c.json({ ok: true, ...steps });
    return serve(gen.bytes);
  }

  if (debug) return c.json({ ok: false, ...steps });
  return new Response(null, { status: 204 });
}
