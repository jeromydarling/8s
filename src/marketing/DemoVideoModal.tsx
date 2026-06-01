import { Player, type PlayerRef } from "@remotion/player";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { Rowel } from "../components/ui";
import { DemoVideo, VIDEO } from "../video/DemoVideo";

// The modal opens from a click (a user gesture), so we start the Remotion Player
// unmuted right away. Music plays through the composition's <Audio src="/api/music">.
export default function DemoVideoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);

    const id = setTimeout(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        p.seekTo(0);
        p.setVolume(1);
        p.unmute();
        p.play();
      } catch {
        /* ignore */
      }
    }, 100);

    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(id);
    };
  }, [open, onClose]);

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
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full bg-bone/10 text-bone transition hover:bg-bone/20"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="aspect-video w-full bg-black">
              <Player
                ref={playerRef}
                component={DemoVideo}
                inputProps={{ audioSrc: "/api/music" }}
                durationInFrames={VIDEO.durationInFrames}
                compositionWidth={VIDEO.width}
                compositionHeight={VIDEO.height}
                fps={VIDEO.fps}
                style={{ width: "100%", height: "100%" }}
                controls
                autoPlay
                loop
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
