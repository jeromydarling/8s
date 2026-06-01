import { Player } from "@remotion/player";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Rowel } from "../components/ui";
import { DemoVideo, VIDEO } from "../video/DemoVideo";

// Music plays through a plain <audio> element (not Remotion's <Audio>, which
// wasn't producing sound in the Player). The modal opens from a click, so we can
// start it immediately; a small unmute toggle covers browsers that still block
// autoplay-with-sound.
export default function DemoVideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);

    const a = audioRef.current;
    if (a) {
      a.volume = 0.55;
      a.currentTime = 0;
      a.muted = false;
      a.play()
        .then(() => setMuted(false))
        .catch(() => {
          // Browser blocked autoplay-with-sound — start muted, show the toggle.
          a.muted = true;
          a.play().catch(() => {});
          setMuted(true);
        });
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      const el = audioRef.current;
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    };
  }, [open, onClose]);

  function unmute() {
    const a = audioRef.current;
    if (!a) return;
    a.muted = false;
    a.volume = 0.55;
    a.play().catch(() => {});
    setMuted(false);
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
            <audio ref={audioRef} src="/api/music" loop preload="auto" />

            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-widest text-gold">
                <Rowel className="h-4 w-4 text-gold" /> The quick tour
              </span>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full bg-bone/10 text-bone transition hover:bg-bone/20"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="relative aspect-video w-full bg-black">
              <Player
                component={DemoVideo}
                inputProps={{ audioSrc: null }}
                durationInFrames={VIDEO.durationInFrames}
                compositionWidth={VIDEO.width}
                compositionHeight={VIDEO.height}
                fps={VIDEO.fps}
                style={{ width: "100%", height: "100%" }}
                autoPlay
                loop
              />
              {muted && (
                <button
                  onClick={unmute}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink shadow-lg transition hover:brightness-105"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z" /></svg>
                  Turn on sound
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
