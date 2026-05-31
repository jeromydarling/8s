import type { Context } from "hono";
import type { Env } from "./index";

// Background music for the demo video. Drop an MP3 into R2 (MEDIA) at
// `audio/tour-music.mp3` — or commit one to public/audio/tour-music.mp3 — and
// the video picks it up automatically. Returns 204 until one exists, so the
// video plays fine (silent) before any track is added.

const KEY = "audio/tour-music.mp3";

export async function musicStatus(c: Context<{ Bindings: Env }>): Promise<Response> {
  let available = false;
  if (c.env.MEDIA) available = !!(await c.env.MEDIA.head(KEY).catch(() => null));
  if (!available) {
    // fall back to a committed static asset if present
    const origin = new URL(c.req.url).origin;
    const head = await c.env.ASSETS.fetch(new Request(`${origin}/audio/tour-music.mp3`, { method: "HEAD" })).catch(
      () => null,
    );
    available = !!head?.ok;
  }
  return c.json({ available });
}

export async function music(c: Context<{ Bindings: Env }>): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(c.req.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const serve = (body: BodyInit) => {
    const resp = new Response(body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" },
    });
    c.executionCtx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  };

  if (c.env.MEDIA) {
    const obj = await c.env.MEDIA.get(KEY).catch(() => null);
    if (obj) return serve(obj.body);
  }
  // committed static fallback
  const origin = new URL(c.req.url).origin;
  const asset = await c.env.ASSETS.fetch(new Request(`${origin}/audio/tour-music.mp3`)).catch(() => null);
  if (asset?.ok) return serve(asset.body!);

  return new Response(null, { status: 204 });
}
