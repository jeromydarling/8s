// Procedural background music bed for the demo video. Pure Node, no deps — a
// warm, simple acoustic-style loop so the video always has real audio to mux.
// Swap freely: commit a real track to public/audio/tour-music.mp3 and the
// render + player use that instead (see render-video.mjs / DemoVideoModal).

import { mkdir, writeFile, access } from "node:fs/promises";

const SR = 44100;
const SECONDS = 23;
const N = SR * SECONDS;
const dir = new URL("../public/audio/", import.meta.url);
const out = new URL("tour-music.wav", dir);
const mp3 = new URL("tour-music.mp3", dir);

await mkdir(dir, { recursive: true });

// If a real mp3 was committed, don't overwrite with the procedural bed.
try {
  await access(mp3);
  console.log("[music] public/audio/tour-music.mp3 present — keeping it");
  process.exit(0);
} catch {
  /* none — synthesize */
}

const A = 440;
const note = (semitonesFromA) => A * Math.pow(2, semitonesFromA / 12);

// I–V–vi–IV in C: C, G, Am, F  (triads, mid octave)
const CHORDS = [
  [-9, -5, -2], // C  E  G
  [-2, 2, 5], //  G  B  D
  [0, 3, 7], //   A  C  E
  [-4, 0, 3], //  F  A  C
].map((ch) => ch.map(note));
const BASS = [note(-21), note(-14), note(-12), note(-16)]; // C2 G2 A2 F2
const PENT = [-9, -7, -5, -2, 0, 3].map((s) => note(s + 12)); // C-major pentatonic up high

const chordDur = SECONDS / 8; // two passes of the 4-chord loop
const buf = new Float32Array(N);

function adsr(t, dur, a = 0.4, r = 0.5) {
  if (t < a) return t / a;
  if (t > dur - r) return Math.max(0, (dur - t) / r);
  return 1;
}

for (let i = 0; i < N; i++) {
  const t = i / SR;
  const ci = Math.floor(t / chordDur) % 4;
  const localT = t - Math.floor(t / chordDur) * chordDur;
  const env = adsr(localT, chordDur, 0.5, 0.6);

  let s = 0;
  // soft pad: chord tones, sine + a touch of 2nd harmonic, gentle detune
  for (const f of CHORDS[ci]) {
    s += Math.sin(2 * Math.PI * f * t) * 0.16;
    s += Math.sin(2 * Math.PI * f * 1.005 * t) * 0.08;
    s += Math.sin(2 * Math.PI * f * 2 * t) * 0.03;
  }
  s *= env;

  // walking-ish bass, plucked
  const beat = 0.5 * (SECONDS / 8) ; // ~ half-chord pulses
  const bt = t % beat;
  const bEnv = Math.exp(-bt * 6);
  s += Math.sin(2 * Math.PI * BASS[ci] * t) * 0.22 * bEnv;

  // sparse pentatonic pluck melody (triangle-ish), changes a few times per chord
  const step = chordDur / 4;
  const mi = Math.floor(t / step);
  const mt = t - mi * step;
  const f = PENT[(mi * 3 + 2) % PENT.length];
  const mEnv = Math.exp(-mt * 7);
  // triangle via summed odd harmonics
  let tri = 0;
  for (let h = 1; h <= 5; h += 2) tri += Math.sin(2 * Math.PI * f * h * t) / (h * h);
  s += tri * 0.5 * 0.18 * mEnv;

  buf[i] = s;
}

// master fade in/out + soft limit
const fadeIn = SR * 1.2;
const fadeOut = SR * 2.0;
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]));
const norm = peak > 0 ? 0.82 / peak : 1;
for (let i = 0; i < N; i++) {
  let v = buf[i] * norm;
  if (i < fadeIn) v *= i / fadeIn;
  if (i > N - fadeOut) v *= (N - i) / fadeOut;
  buf[i] = Math.tanh(v * 1.1); // gentle saturation
}

// encode 16-bit PCM mono WAV
const bytesPer = 2;
const dataLen = N * bytesPer;
const ab = new ArrayBuffer(44 + dataLen);
const dv = new DataView(ab);
const wstr = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
wstr(0, "RIFF"); dv.setUint32(4, 36 + dataLen, true); wstr(8, "WAVE");
wstr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
dv.setUint32(24, SR, true); dv.setUint32(28, SR * bytesPer, true); dv.setUint16(32, bytesPer, true); dv.setUint16(34, 16, true);
wstr(36, "data"); dv.setUint32(40, dataLen, true);
for (let i = 0; i < N; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, buf[i])) * 32767, true);

await writeFile(out, Buffer.from(ab));
console.log(`[music] wrote public/audio/tour-music.wav (${SECONDS}s, ${(ab.byteLength / 1024 / 1024).toFixed(1)}MB)`);
