import { Player, type PlayerRef } from "@remotion/player";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Rowel } from "../components/ui";
import { DemoVideo, VIDEO } from "../video/DemoVideo";

export default function DemoVideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const playerRef = useRef<PlayerRef>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    // Attach the AI music track. Warm the cache immediately; once it's ready we
    // point the composition's <Audio> at it. Browsers block autoplay-with-sound,
    // so playback starts muted and the user flips sound on (a real gesture).
    fetch("/api/music/status")
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d: { available?: boolean }) => {
        if (alive && d.available) setAudioSrc("/api/music");
      })
      .catch(() => {});
    // Kick off generation/caching even if not yet ready, so it's there next time.
    fetch("/api/music").catch(() => {});

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function toggleSound() {
    const p = playerRef.current;
    if (!p) return;
    if (soundOn) {
      p.mute();
      setSoundOn(false);
      return;
    }
    if (!audioSrc) setAudioSrc("/api/music");
    p.unmute();
    p.setVolume(1);
    p.seekTo(0);
    p.play();
    setSoundOn(true);
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
                <button
                  onClick={toggleSound}
                  className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink transition hover:brightness-105"
                >
                  {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
                  {soundOn ? "Sound on" : "Play with sound"}
                </button>
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
              <Player
                ref={playerRef}
                component={DemoVideo}
                inputProps={{ audioSrc }}
                durationInFrames={VIDEO.durationInFrames}
                compositionWidth={VIDEO.width}
                compositionHeight={VIDEO.height}
                fps={VIDEO.fps}
                style={{ width: "100%", height: "100%" }}
                controls
                autoPlay
                loop
                initiallyMuted
                clickToPlay={false}
                doubleClickToFullscreen
              />
              {!soundOn && (
                <button
                  onClick={toggleSound}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-ink/80 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-bone backdrop-blur transition hover:bg-ink"
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

function SoundOnIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4zm-2.5-9v2a7 7 0 010 14v2a9 9 0 000-18z" />
    </svg>
  );
}
function SoundOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm18.5 3l-2.3-2.3-1.4 1.4L20.1 13.4 17.8 15.7l1.4 1.4 2.3-2.3 2.3 2.3 1.4-1.4-2.3-2.3z" transform="translate(-2.5,-1.4)" />
    </svg>
  );
}
