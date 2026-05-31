// Build-time curated-art fetch. Runs inside Workers Builds (which has internet
// egress, unlike a local dev sandbox). For each entry in art-manifest.json it
// downloads the image into public/art/<slug>.jpg — where the Worker's art
// endpoint serves it as the authoritative override — and best-effort copies it
// to R2 for durability. Never fails the build: a dead/expired URL is skipped.

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import manifest from "../art-manifest.json" with { type: "json" };

const ART_VERSION = "5"; // keep in sync with worker/art.ts
const pexec = promisify(execFile);
const dir = new URL("../public/art/", import.meta.url);

await mkdir(dir, { recursive: true });

for (const [slug, url] of Object.entries(manifest)) {
  if (!url) continue;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[art] ${slug}: source returned HTTP ${res.status} — skipping`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) {
      console.warn(`[art] ${slug}: response too small (${buf.length}b) — skipping`);
      continue;
    }
    const file = new URL(`${slug}.jpg`, dir);
    await writeFile(file, buf);
    console.log(`[art] ${slug}: ${buf.length} bytes -> public/art/${slug}.jpg`);

    // Durable copy to R2 (succeeds in CI where wrangler is authenticated).
    try {
      await pexec("npx", [
        "wrangler", "r2", "object", "put",
        `eight-seconds-media/art/v${ART_VERSION}/${slug}.png`,
        "--file", fileURLToPath(file),
        "--content-type", "image/jpeg",
        "--remote",
      ]);
      console.log(`[art] ${slug}: copied to R2`);
    } catch {
      /* no R2 auth (e.g. local) — public/art copy still serves this deploy */
    }
  } catch (err) {
    console.warn(`[art] ${slug}: ${err?.message ?? err} — skipping`);
  }
}
