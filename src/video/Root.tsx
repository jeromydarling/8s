import { Composition, staticFile } from "remotion";
import { DemoVideo, VIDEO } from "./DemoVideo";

// Remotion registration used only by the renderer (scripts/render-video.mjs).
// The site itself plays the rendered MP4 directly; the live Player is a fallback.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="tour"
      component={DemoVideo}
      durationInFrames={VIDEO.durationInFrames}
      fps={VIDEO.fps}
      width={VIDEO.width}
      height={VIDEO.height}
      defaultProps={{ audioSrc: staticFile("audio/tour-music.wav") as string }}
    />
  );
};
