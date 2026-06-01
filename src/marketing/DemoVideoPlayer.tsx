import { Player, type PlayerRef } from "@remotion/player";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { DemoVideo, VIDEO } from "../video/DemoVideo";

export interface PlayerHandle {
  toggleSound: (on: boolean) => void;
}

// Fallback when the prerendered MP4 isn't available: live in-browser playback
// with the music bed muxed in via the composition's <Audio>. Starts muted
// (autoplay rule); the modal unmutes on a user click.
const MUSIC = "/api/music";

const DemoVideoPlayer = forwardRef<PlayerHandle>((_, ref) => {
  const playerRef = useRef<PlayerRef>(null);

  useImperativeHandle(ref, () => ({
    toggleSound(on: boolean) {
      const p = playerRef.current;
      if (!p) return;
      if (on) {
        p.unmute();
        p.setVolume(1);
        p.seekTo(0);
        p.play();
      } else {
        p.mute();
      }
    },
  }));

  return (
    <Player
      ref={playerRef}
      component={DemoVideo}
      inputProps={{ audioSrc: MUSIC }}
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
    />
  );
});
DemoVideoPlayer.displayName = "DemoVideoPlayer";
export default DemoVideoPlayer;
