import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Rowel } from "../components/ui";
import type { PlayerHandle } from "./DemoVideoPlayer";

const PlayerFallback = lazy(() => import("./DemoVideoPlayer"));
const MP4_SRC = "/video/tour.mp4";

export default function DemoVideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<PlayerHandle>(null);
  const [mode, setMode] = useState<"loading" | "mp4" | "player">("loading");
  const [muted, setMuted] = useState(true);

  // Prefer the prerendered MP4 (visuals + music muxed). Fall back to live player.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(MP4_SRC, { method: "HEAD" })
      .then((r) => {
        if (!alive) return;
        setMode(r.ok && (r.headers.get("content-type") || "").includes("video") ? "mp4" : "player");
      })
      .catch(() => alive && setMode("player"));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function toggleSound() {
    const next = !muted;
    if (mode === "mp4") {
      const v = videoRef.current;
      if (v) {
        v.muted = !next;
        if (next) v.play().catch(() => {});
      }
    } else {
      playerRef.current?.toggleSound(next);
    }
    setMuted(!next);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/80 backdrop-blur-md" onClick={onClose} />
          <motion.div
            className="relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl bg-ink shadow-lift ring-1 ring-bone/10"
            initial={{ scale: 0.94, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 12, opacity: 0 }}
            transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.45 }}
          >
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-widest text-gold">
                <Rowel className="h-4 w-4 text-gold" /> The quick tour
              </span>
              <div className="flex items-center gap-2">
                {mode !== "loading" && (
                  <button
                    onClick={toggleSound}
                    className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink transition hover:brightness-105"
                  >
                    {muted ? <SoundOffIcon /> : <SoundOnIcon />}
                    {muted ? "Play with sound" : "Sound on"}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="grid h-8 w-8 place-items-center rounded-full bg-bone/10 text-bone transition hover:bg-bone/20"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="relative aspect-video w-full bg-black">
              {mode === "mp4" && (
                <video
                  ref={videoRef}
                  src={MP4_SRC}
                  className="h-full w-full"
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls
                />
              )}

              {mode === "player" && (
                <Suspense fallback={<Spinner />}>
                  <PlayerFallback ref={playerRef} />
                </Suspense>
              )}

              {mode === "loading" && <Spinner />}

              {mode !== "loading" && muted && (
                <button
                  onClick={toggleSound}
                  className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-ink/85 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-bone backdrop-blur transition hover:bg-ink"
                >
                  <SoundOffIcon /> Tap for sound
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Spinner() {
  return (
    <div className="grid h-full place-items-center">
      <Rowel className="h-8 w-8 animate-spin text-gold [animation-duration:1.4s]" />
    </div>
  );
}
function SoundOnIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4z" />
    </svg>
  );
}
function SoundOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3z" />
    </svg>
  );
}
