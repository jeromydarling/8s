// Build-time: pull the real ElevenLabs track from the deployed Worker so the
// rendered MP4 muxes it. Non-fatal — if it isn't available yet, the video falls
// back to streaming /api/music at runtime via the player.

import { mkdir, writeFile, stat } from "node:fs/promises";

const dir = new URL("../public/audio/", import.meta.url);
const out = new URL("tour-music.mp3", dir);
const URL_SRC = process.env.MUSIC_URL || "https://8s.rodeo/api/music";

await mkdir(dir, { recursive: true });

try {
  // Skip if we already have a non-trivial mp3.
  try {
    const s = await stat(out);
    if (s.size > 50_000) {
      console.log("[music] tour-music.mp3 already present — keeping it");
      process.exit(0);
    }
  } catch {
    /* not present */
  }

  const res = await fetch(URL_SRC);
  if (!res.ok) {
    console.warn(`[music] ${URL_SRC} -> HTTP ${res.status}; skipping (runtime fallback will stream it)`);
    process.exit(0);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 50_000) {
    console.warn(`[music] response too small (${buf.length}b); skipping`);
    process.exit(0);
  }
  await writeFile(out, buf);
  console.log(`[music] fetched ${(buf.length / 1024).toFixed(0)}KB -> public/audio/tour-music.mp3`);
} catch (err) {
  console.warn(`[music] fetch skipped: ${err?.message ?? err}`);
  process.exit(0);
}
