import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ReactNode } from "react";

/* ===========================================================================
   8 Seconds — fast, text-driven app tour. Kinetic type over a vintage arena
   watercolor, in the site palette. Played live via @remotion/player; optional
   background music. No narration.
   =========================================================================== */

export const VIDEO = { fps: 30, width: 1280, height: 720, durationInFrames: 690 };

const C = {
  ink: "#2b1d12",
  leather: "#3a2818",
  bone: "#faf4e8",
  rust: "#b8502b",
  gold: "#e0a458",
  wheat: "#ecc785",
  sage: "#7e8f63",
};
const DISPLAY = "Oswald, 'Arial Narrow', sans-serif";
const SERIF = "Bitter, Georgia, serif";

const ARENA = "/api/art/hero?v=7";

function useSpringAt(delay = 0, damping = 16) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.6 } });
}

/* Backdrop: the arena watercolor with a slow Ken-Burns push + warm scrim. */
function Backdrop({ tint = "rgba(43,29,18,0.62)" }: { tint?: string }) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, VIDEO.durationInFrames], [1.08, 1.2]);
  const drift = interpolate(frame, [0, VIDEO.durationInFrames], [0, -30]);
  return (
    <AbsoluteFill>
      <Img
        src={ARENA}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateY(${drift}px)`,
        }}
      />
      <AbsoluteFill style={{ background: tint }} />
      <AbsoluteFill style={{ background: "radial-gradient(120% 80% at 50% 40%, transparent 40%, rgba(34,23,16,0.7) 100%)" }} />
    </AbsoluteFill>
  );
}

function Rowel({ size = 80, color = C.gold, spin = 0 }: { size?: number; color?: string; spin?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 11 : 5.2;
    return `${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${spin}deg)` }}>
      <polygon points={pts} fill={color} />
      <circle cx="12" cy="12" r="3.1" fill={C.bone} />
      <circle cx="12" cy="12" r="1.5" fill={color} />
    </svg>
  );
}

/* A line of type that springs up + fades, then drifts. */
function Line({
  children,
  delay = 0,
  size = 60,
  color = C.bone,
  weight = 700,
  font = DISPLAY,
  letter = 0,
}: {
  children: ReactNode;
  delay?: number;
  size?: number;
  color?: string;
  weight?: number;
  font?: string;
  letter?: number;
}) {
  const s = useSpringAt(delay);
  const frame = useCurrentFrame();
  const drift = interpolate(frame - delay, [0, 120], [0, -14], { extrapolateLeft: "clamp" });
  return (
    <div
      style={{
        fontFamily: font,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.0,
        color,
        letterSpacing: letter,
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [44, drift])}px)`,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const s = useSpringAt(delay);
  return (
    <div
      style={{
        fontFamily: DISPLAY,
        textTransform: "uppercase",
        letterSpacing: 10,
        fontSize: 20,
        color: C.gold,
        marginBottom: 18,
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [20, 0])}px)`,
      }}
    >
      {children}
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", padding: 80 }}>
      {children}
    </AbsoluteFill>
  );
}

/* Wipe transition between scenes for snap. */
function Wipe() {
  const s = useSpringAt(0, 20);
  const frame = useCurrentFrame();
  const out = interpolate(frame, [8, 18], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        background: C.rust,
        clipPath: `inset(0 0 ${interpolate(s, [0, 1], [0, 100])}% 0)`,
        opacity: 1 - out / 100,
      }}
    />
  );
}

/* ============================ SCENES ============================ */
function Intro() {
  const r = useSpringAt(0, 11);
  const frame = useCurrentFrame();
  const timer = interpolate(frame, [16, 70], [0, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Backdrop tint="rgba(43,29,18,0.7)" />
      <Center>
        <div style={{ transform: `scale(${interpolate(r, [0, 1], [0.3, 1])}) rotate(${interpolate(r, [0, 1], [-140, 0])}deg)`, opacity: r, marginBottom: 18 }}>
          <Rowel size={96} />
        </div>
        <Line size={104} letter={2} delay={6}>8&nbsp;SECONDS</Line>
        <div style={{ marginTop: 8 }}>
          <Line size={26} font={SERIF} weight={400} color={C.wheat} delay={14}>
            Youth rodeo, all in one place.
          </Line>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 40, width: 520 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 8, background: "rgba(250,244,232,0.18)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(timer / 8) * 100}%`, background: C.gold }} />
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 30, color: C.gold, width: 76, textAlign: "right" }}>
            {timer.toFixed(1)}s
          </div>
        </div>
      </Center>
    </AbsoluteFill>
  );
}

function Problem() {
  return (
    <AbsoluteFill>
      <Backdrop />
      <Center>
        <Eyebrow delay={2}>The most passionate sport in America</Eyebrow>
        <Line size={58} delay={6}>Scattered across a dozen sites.</Line>
        <Line size={58} delay={16}>Spreadsheets. Group texts.</Line>
        <Line size={58} delay={26} color={C.wheat}>Notarized paper forms.</Line>
        <div style={{ marginTop: 26 }}>
          <Line size={72} delay={40} color={C.gold}>Until now.</Line>
        </div>
      </Center>
    </AbsoluteFill>
  );
}

function Feature({
  eyebrow,
  headline,
  sub,
}: {
  eyebrow: string;
  headline: string;
  sub: string;
}) {
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 90px" }}>
        <Eyebrow delay={2}>{eyebrow}</Eyebrow>
        <Line size={88} delay={6}>{headline}</Line>
        <div style={{ marginTop: 16, maxWidth: 760 }}>
          <Line size={28} font={SERIF} weight={400} color={C.wheat} delay={16}>
            {sub}
          </Line>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Outro() {
  const frame = useCurrentFrame();
  const t = useSpringAt(8);
  return (
    <AbsoluteFill>
      <Backdrop tint="rgba(43,29,18,0.72)" />
      <Center>
        <div style={{ transform: `rotate(${interpolate(frame, [0, 150], [0, 80])}deg)`, opacity: useSpringAt(0, 11) }}>
          <Rowel size={84} />
        </div>
        <div style={{ marginTop: 18 }}>
          <Line size={92} delay={6}>Make it count.</Line>
        </div>
        <div style={{ marginTop: 10 }}>
          <Line size={26} font={SERIF} weight={400} color={C.wheat} delay={14}>
            See the live, fully seeded demo — free.
          </Line>
        </div>
        <div
          style={{
            fontFamily: DISPLAY,
            textTransform: "uppercase",
            letterSpacing: 6,
            fontSize: 24,
            color: C.ink,
            background: C.gold,
            padding: "14px 34px",
            borderRadius: 40,
            marginTop: 30,
            opacity: t,
            transform: `scale(${interpolate(t, [0, 1], [0.8, 1])})`,
          }}
        >
          8s.rodeo
        </div>
      </Center>
    </AbsoluteFill>
  );
}

/* ============================ COMPOSITION ============================ */
export const DemoVideo: React.FC<{ audioSrc?: string | null }> = ({ audioSrc }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      {audioSrc ? <Audio src={audioSrc} volume={0.6} /> : null}

      <Sequence durationInFrames={95}><Intro /></Sequence>
      <Sequence from={95} durationInFrames={90}><Problem /></Sequence>

      <Sequence from={185} durationInFrames={80}>
        <Feature eyebrow="The Draw" headline="Every event, one feed." sub="NHSRA, NLBRA, your local jackpots — filtered, with deadline alerts so you never miss a draw." />
      </Sequence>
      <Sequence from={265} durationInFrames={80}>
        <Feature eyebrow="The Buckle Board" headline="Know where they stand." sub="Every qualifying ladder, mapped — points, placings, days left. No more calling directors to guess." />
      </Sequence>
      <Sequence from={345} durationInFrames={80}>
        <Feature eyebrow="The Tack Room" headline="The horse comes first." sub="Farrier and vet reminders, a run log, the whole family and every horse under one roof." />
      </Sequence>
      <Sequence from={425} durationInFrames={80}>
        <Feature eyebrow="The Sponsor Pen" headline="Sponsor-ready in a tap." sub="A shareable media kit with stats and schedule — ready to send a feed store before homework." />
      </Sequence>
      <Sequence from={505} durationInFrames={80}>
        <Feature eyebrow="The Gatepost" headline="Fight for the arena." sub="When development threatens the grounds that raised us, organize the fight — together." />
      </Sequence>

      <Sequence from={585} durationInFrames={105}><Outro /></Sequence>

      {/* scene wipes */}
      {[95, 185, 265, 345, 425, 505, 585].map((f) => (
        <Sequence key={f} from={f - 6} durationInFrames={20}>
          <Wipe />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
