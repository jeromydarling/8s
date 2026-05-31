# 8 Seconds — TODO / parked work

## Audio for the demo video (PARKED — revisit)
- Current `scripts/make-music.mjs` is a **procedural synth bed** and sounds like
  beeping — not shippable. Options when we return:
  1. Drop a real royalty-free country/Americana MP3 at `public/audio/tour-music.mp3`
     (it overrides the synth and gets muxed into the MP4 + used by the player).
  2. ElevenLabs **Music** API (needs `ELEVENLABS_API_KEY` Worker secret) to
     generate a track once, commit/store it.
  3. A licensed track from the user.
- The video pipeline itself works: `scripts/render-video.mjs` muxes whatever is in
  `public/audio/tour-music.{mp3,wav}` into `/video/tour.mp4`; the modal plays the
  MP4 (or falls back to the live player with the same audio).
- Note: MP4 render needs Remotion's headless Chrome download, which is blocked in
  the dev sandbox (403). Verify it succeeds in Workers Builds CI; if not, we ship
  the live-player fallback.

## Maps (IN PROGRESS)
- Mapbox GL for event/arena discovery + travel planning.
- Perplexity API to seed real youth-rodeo events/arenas → geocode → D1.
- Keys needed: `MAPBOX_TOKEN` (public pk.*, Worker var), `PERPLEXITY_API_KEY` (secret).
