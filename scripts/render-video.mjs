// Render the Remotion tour to a single MP4 (visuals + music muxed) so the site
// can serve a plain <video> — no browser autoplay-with-sound headaches. Runs in
// CI (Workers Builds) before vite build. Non-fatal: if anything fails, the site
// falls back to the live @remotion/player. Skips re-render if output exists and
// inputs are older (keeps incremental deploys fast).

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer";
import { stat, mkdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Render is best-effort: never let it fail the deploy. The site falls back to
// the live @remotion/player (with synced audio) when no MP4 is produced.
process.on("unhandledRejection", (e) => {
  console.warn(`[video] render skipped: ${e?.message ?? e}`);
  process.exit(0);
});
process.on("uncaughtException", (e) => {
  console.warn(`[video] render skipped: ${e?.message ?? e}`);
  process.exit(0);
});

const root = fileURLToPath(new URL("..", import.meta.url));
const entry = path.join(root, "src/video/index.ts");
const outDir = path.join(root, "public/video");
const outFile = path.join(outDir, "tour.mp4");

async function mtime(p) {
  try { return (await stat(p)).mtimeMs; } catch { return 0; }
}

try {
  await mkdir(outDir, { recursive: true });

  // Skip if MP4 is newer than the composition + audio inputs.
  const outAge = await mtime(outFile);
  if (outAge) {
    const inputs = await Promise.all([
      mtime(path.join(root, "src/video/DemoVideo.tsx")),
      mtime(path.join(root, "src/video/Root.tsx")),
      mtime(path.join(root, "public/audio/tour-music.wav")),
      mtime(path.join(root, "public/audio/tour-music.mp3")),
    ]);
    if (Math.max(...inputs) < outAge) {
      console.log("[video] tour.mp4 up to date — skipping render");
      process.exit(0);
    }
  }

  console.log("[video] ensuring headless browser…");
  await ensureBrowser();

  console.log("[video] bundling composition…");
  const serveUrl = await bundle({ entryPoint: entry, onProgress: () => {} });

  // Prefer a committed real mp3 if present, else the procedural wav.
  let audioFile = "audio/tour-music.wav";
  try {
    await access(path.join(root, "public/audio/tour-music.mp3"));
    audioFile = "audio/tour-music.mp3";
  } catch { /* use wav */ }

  const composition = await selectComposition({
    serveUrl,
    id: "tour",
    inputProps: { audioSrc: `/${audioFile}` },
  });

  console.log(`[video] rendering ${composition.durationInFrames} frames with ${audioFile}…`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outFile,
    inputProps: { audioSrc: `/${audioFile}` },
    audioCodec: "aac",
    crf: 23,
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 20 === 0) process.stdout.write(`\r[video] ${Math.round(progress * 100)}%`);
    },
  });
  console.log(`\n[video] wrote ${path.relative(root, outFile)}`);
} catch (err) {
  console.warn(`[video] render skipped: ${err?.message ?? err}`);
  process.exit(0); // never fail the build
}
