import type { Context } from "hono";
import type { Env } from "./index";

// ElevenLabs narration for the demo video. Synthesized once on the deployed
// Worker (which has egress), cached in R2 + the edge cache. Returns nothing
// until ELEVENLABS_API_KEY is set as a Worker secret — the video plays silent
// until then, then picks up audio automatically.

const SCRIPT_VERSION = "1";
const DEFAULT_VOICE = "pNInz6obpgDQGcFmaJgB"; // ElevenLabs "Adam" — warm narrator

const SCRIPT = `Youth rodeo. The most passionate community in sports, and the most underserved. Eight Seconds changes that. Every event, in one feed. Every qualifying ladder, mapped, so you always know where they stand. Your horse, treated like the athlete it is. A sponsor media kit, ready in a tap. And when an arena is threatened, a way to fight back, together. One hub, for the whole family. See the live, fully seeded demo, free, at eight S dot rodeo.`;

function audioKey(env: Env): string {
  return `narration/v${SCRIPT_VERSION}-${env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE}.mp3`;
}

export async function narrationStatus(c: Context<{ Bindings: Env }>): Promise<Response> {
  let cached = false;
  if (c.env.MEDIA) cached = !!(await c.env.MEDIA.head(audioKey(c.env)).catch(() => null));
  return c.json({ available: cached || !!c.env.ELEVENLABS_API_KEY });
}

export async function narration(c: Context<{ Bindings: Env }>): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(c.req.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const key = audioKey(c.env);

  const serve = (body: BodyInit) => {
    const resp = new Response(body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000" },
    });
    c.executionCtx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  };

  // R2 cache first.
  if (c.env.MEDIA) {
    const obj = await c.env.MEDIA.get(key).catch(() => null);
    if (obj) return serve(obj.body);
  }

  if (!c.env.ELEVENLABS_API_KEY) return new Response(null, { status: 204 });

  try {
    const voice = c.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": c.env.ELEVENLABS_API_KEY,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: SCRIPT,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
        }),
      },
    );
    if (!res.ok) {
      console.error("ElevenLabs error", res.status, await res.text().catch(() => ""));
      return new Response(null, { status: 502 });
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (c.env.MEDIA) {
      c.executionCtx.waitUntil(
        c.env.MEDIA.put(key, bytes, { httpMetadata: { contentType: "audio/mpeg" } }).then(() => undefined),
      );
    }
    return serve(bytes);
  } catch (err) {
    console.error("narration synth failed", err);
    return new Response(null, { status: 502 });
  }
}
