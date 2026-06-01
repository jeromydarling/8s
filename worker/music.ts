import type { Context } from "hono";
import type { Env } from "./index";

// Background music for the demo video, generated once by ElevenLabs Music and
// cached in R2. Instrumental country/Americana to match the rodeo voice.
// Order: R2 cache -> committed static asset -> ElevenLabs generation.
// /api/music?debug=1 always returns JSON describing what happened.

const VERSION = "2";
const KEY = `audio/tour-music-v${VERSION}.mp3`;
const LENGTH_MS = 24_000;
const PROMPT =
  "Warm instrumental country Americana for a heartfelt rodeo brand film. Gentle fingerpicked acoustic guitar, soft pedal steel, light brushed drums and upright bass, hopeful and uplifting, wide-open Western feeling, mid-tempo, no vocals, no spoken word.";

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
  // Can also generate on demand if the key is present.
  return c.json({ available: available || !!c.env.ELEVEN_LABS_API_KEY });
}

async function generate(env: Env): Promise<{ bytes: Uint8Array | null; info: Record<string, unknown> }> {
  if (!env.ELEVEN_LABS_API_KEY) return { bytes: null, info: { reason: "no ELEVEN_LABS_API_KEY" } };
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVEN_LABS_API_KEY,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({ prompt: PROMPT, music_length_ms: LENGTH_MS }),
    });
    if (!res.ok) {
      return { bytes: null, info: { status: res.status, body: (await res.text().catch(() => "")).slice(0, 200) } };
    }
    const ct = res.headers.get("content-type") ?? "";
    // Some plans return JSON with a base64 field; most return raw audio.
    if (ct.includes("application/json")) {
      const j = (await res.json()) as { audio_base64?: string; audio?: string };
      const b64 = j.audio_base64 ?? j.audio;
      if (b64) return { bytes: Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)), info: { shape: "json" } };
      return { bytes: null, info: { shape: "json", keys: Object.keys(j) } };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, info: { shape: "audio", bytes: bytes.byteLength } };
  } catch (err) {
    return { bytes: null, info: { error: String(err) } };
  }
}

export async function music(c: Context<{ Bindings: Env }>): Promise<Response> {
  const debug = c.req.query("debug") === "1";
  const steps: Record<string, unknown> = { hasKey: !!c.env.ELEVEN_LABS_API_KEY, hasMedia: !!c.env.MEDIA };

  // Resolve the MP3 bytes once (R2 -> committed asset -> ElevenLabs), then serve
  // with Content-Length + Range support — media elements (incl. Remotion <Audio>)
  // need byte-range responses or they refuse to play.
  let bytes: Uint8Array | null = null;

  if (c.env.MEDIA) {
    const obj = await c.env.MEDIA.get(KEY).catch(() => null);
    steps.r2Hit = !!obj;
    if (obj) bytes = new Uint8Array(await obj.arrayBuffer());
  }

  if (!bytes) {
    const origin = new URL(c.req.url).origin;
    const asset = await c.env.ASSETS.fetch(new Request(`${origin}/audio/tour-music.mp3`)).catch(() => null);
    steps.assetHit = !!asset?.ok;
    if (asset?.ok) bytes = new Uint8Array(await asset.arrayBuffer());
  }

  if (!bytes) {
    const gen = await generate(c.env);
    steps.generate = gen.info;
    if (gen.bytes && gen.bytes.byteLength > 1024) {
      bytes = gen.bytes;
      if (c.env.MEDIA) {
        c.executionCtx.waitUntil(
          c.env.MEDIA.put(KEY, gen.bytes, { httpMetadata: { contentType: "audio/mpeg" } }).then(() => undefined),
        );
      }
    }
  }

  if (debug) return c.json({ ok: !!bytes, bytes: bytes?.byteLength ?? 0, ...steps });
  if (!bytes) return new Response(null, { status: 204 });

  const total = bytes.byteLength;
  const range = c.req.header("range");
  const baseHeaders: Record<string, string> = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000",
  };

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : total - 1;
    if (start >= total || start > end) {
      return new Response(null, { status: 416, headers: { ...baseHeaders, "Content-Range": `bytes */${total}` } });
    }
    const slice = bytes.subarray(start, end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(slice.byteLength),
      },
    });
  }

  return new Response(bytes, { status: 200, headers: { ...baseHeaders, "Content-Length": String(total) } });
}
