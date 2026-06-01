import type { Context } from "hono";
import type { Env } from "./index";

// Background music for the demo video, generated once by ElevenLabs Music and
// cached in R2. Instrumental country/Americana to match the rodeo voice.
// Order: R2 cache -> committed static asset -> ElevenLabs generation.
// /api/music?debug=1 always returns JSON describing what happened.

const VERSION = "4";
const KEY = `audio/tour-music-v${VERSION}.mp3`;
const LENGTH_MS = 38_000;
const PROMPT =
  "Fast, driving dark country instrumental in a minor key. Brooding outlaw/Western noir mood. Gritty palm-muted baritone electric guitar and resonator slide, galloping low tom and stomp-clap rhythm, dark walking upright bass, ominous fiddle stabs, hand percussion. Tense, cinematic, propulsive, building intensity. Spaghetti-western edge. No vocals, no spoken word.";

// True only for real MP3 bytes (ID3 tag or MPEG frame sync). Guards against a
// poisoned cache — e.g. an earlier build saved the SPA index.html as the mp3.
function isMp3(b: Uint8Array | null | undefined): boolean {
  if (!b || b.byteLength < 1024) return false;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true; // "ID3"
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return true; // frame sync
  return false;
}

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

  // 1) R2 cache — only trust it if it's real MP3.
  if (c.env.MEDIA) {
    const obj = await c.env.MEDIA.get(KEY).catch(() => null);
    if (obj) {
      const b = new Uint8Array(await obj.arrayBuffer());
      steps.r2Hit = isMp3(b) ? "valid" : "rejected (not mp3)";
      if (isMp3(b)) bytes = b;
    } else {
      steps.r2Hit = false;
    }
  }

  // 2) ElevenLabs generation — the source of truth. (We intentionally do NOT
  //    read the committed /audio asset: an earlier build poisoned it with HTML.)
  if (!bytes) {
    const gen = await generate(c.env);
    steps.generate = gen.info;
    if (isMp3(gen.bytes)) {
      bytes = gen.bytes;
      if (c.env.MEDIA) {
        c.executionCtx.waitUntil(
          c.env.MEDIA.put(KEY, bytes, { httpMetadata: { contentType: "audio/mpeg" } }).then(() => undefined),
        );
      }
    }
  }

  if (debug) {
    // Magic-byte sniff so we can confirm it's actually MP3 audio, not text/JSON.
    let head = "";
    let kind = "unknown";
    if (bytes) {
      const n = bytes.subarray(0, 4);
      head = [...n].map((b) => b.toString(16).padStart(2, "0")).join(" ");
      if (n[0] === 0x49 && n[1] === 0x44 && n[2] === 0x33) kind = "mp3 (ID3)";
      else if (n[0] === 0xff && (n[1] & 0xe0) === 0xe0) kind = "mp3 (frame sync)";
      else if (n[0] === 0x7b || n[0] === 0x5b) kind = "json/text (NOT audio)";
      else if (n[0] === 0x52 && n[1] === 0x49 && n[2] === 0x46) kind = "wav/riff";
    }
    return c.json({ ok: !!bytes, bytes: bytes?.byteLength ?? 0, head, kind, ...steps });
  }
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
