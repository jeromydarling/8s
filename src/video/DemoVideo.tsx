import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { ReactNode } from "react";

/* ===========================================================================
   8 Seconds — in-browser Remotion app tour. Fast, warm, fun. Played live via
   @remotion/player (no MP4 render needed). Reuses the site's palette + rowel.
   =========================================================================== */

export const VIDEO = { fps: 30, width: 1280, height: 720, durationInFrames: 960 };

const C = {
  ink: "#2b1d12",
  leather: "#3a2818",
  hide: "#221710",
  bone: "#faf4e8",
  paper: "#f4ead6",
  rust: "#b8502b",
  ember: "#c2602f",
  gold: "#e0a458",
  wheat: "#ecc785",
  sage: "#7e8f63",
  sageDeep: "#5f6f48",
  saddle: "#8a5a3b",
  turq: "#2f8f8a",
};
const DISPLAY = "Oswald, 'Arial Narrow', sans-serif";
const SERIF = "Bitter, Georgia, serif";

function useEnter(delay = 0, config?: { damping?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: config?.damping ?? 14, mass: 0.6 } });
}

/* --- spur rowel --- */
function Rowel({ size = 80, color = C.rust, spin = 0 }: { size?: number; color?: string; spin?: number }) {
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

function Caption({
  eyebrow,
  title,
  tone = C.bone,
}: {
  eyebrow: string;
  title: string;
  tone?: string;
}) {
  const e = useEnter(4);
  const t = useEnter(10);
  return (
    <div style={{ position: "absolute", left: 70, bottom: 70, maxWidth: 560 }}>
      <div
        style={{
          fontFamily: DISPLAY,
          textTransform: "uppercase",
          letterSpacing: 8,
          fontSize: 20,
          color: C.gold,
          opacity: e,
          transform: `translateY(${interpolate(e, [0, 1], [20, 0])}px)`,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 66,
          lineHeight: 0.98,
          color: tone,
          marginTop: 10,
          opacity: t,
          transform: `translateY(${interpolate(t, [0, 1], [30, 0])}px)`,
        }}
      >
        {title}
      </div>
    </div>
  );
}

/* --- phone mock --- */
function Phone({ children, delay = 0, x = 0 }: { children: ReactNode; delay?: number; x?: number }) {
  const s = useEnter(delay);
  return (
    <div
      style={{
        position: "absolute",
        right: 110 + x,
        top: 80,
        width: 300,
        height: 560,
        borderRadius: 46,
        background: C.leather,
        padding: 12,
        boxShadow: "0 50px 90px -30px rgba(0,0,0,0.6)",
        transform: `translateY(${interpolate(s, [0, 1], [120, 0])}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
        opacity: s,
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: 36, background: C.bone, overflow: "hidden", padding: 16 }}>
        {children}
      </div>
    </div>
  );
}

function Bar({ pct, color = C.rust, delay = 0 }: { pct: number; color?: string; delay?: number }) {
  const f = useCurrentFrame();
  const w = interpolate(f - delay, [0, 30], [0, pct], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ height: 12, borderRadius: 8, background: "rgba(43,29,18,0.1)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 8 }} />
    </div>
  );
}

function Row({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const s = useEnter(delay);
  return (
    <div style={{ opacity: s, transform: `translateX(${interpolate(s, [0, 1], [40, 0])}px)` }}>{children}</div>
  );
}

const screenTitle: React.CSSProperties = { fontFamily: DISPLAY, fontWeight: 700, fontSize: 24, color: C.ink };
const screenEyebrow: React.CSSProperties = {
  fontFamily: DISPLAY,
  textTransform: "uppercase",
  letterSpacing: 4,
  fontSize: 11,
  color: C.saddle,
};
const card: React.CSSProperties = {
  border: "1px solid rgba(138,90,59,0.18)",
  borderRadius: 18,
  padding: 12,
  background: "rgba(255,255,255,0.6)",
  marginTop: 10,
};

/* ============================ SCENES ============================ */
function Intro() {
  const frame = useCurrentFrame();
  const r = useEnter(0, { damping: 12 });
  const word = useEnter(8);
  const timer = interpolate(frame, [20, 80], [0, 8], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.leather, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${interpolate(r, [0, 1], [0.4, 1])}) rotate(${interpolate(r, [0, 1], [-120, 0])}deg)`, opacity: r }}>
        <Rowel size={120} color={C.gold} />
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 96,
          letterSpacing: 2,
          color: C.bone,
          marginTop: 24,
          opacity: word,
          transform: `translateY(${interpolate(word, [0, 1], [30, 0])}px)`,
        }}
      >
        8&nbsp;SECONDS
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 24, color: C.wheat, marginTop: 6, opacity: word }}>
        Youth rodeo, all in one place.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 40, width: 520, opacity: word }}>
        <div style={{ flex: 1, height: 8, borderRadius: 8, background: "rgba(250,244,232,0.15)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(timer / 8) * 100}%`, background: C.gold }} />
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 28, color: C.gold, width: 70, textAlign: "right" }}>
          {timer.toFixed(1)}s
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SceneFrame({ bg, children, caption }: { bg: string; children: ReactNode; caption: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: bg }}>
      {children}
      {caption}
    </AbsoluteFill>
  );
}

function DrawScene() {
  const events = [
    ["Cross Timbers Youth Rodeo", "Stephenville, TX", "Jun 6", C.rust, "Closes 3d"],
    ["NHSRA Texas State Finals", "Fort Worth, TX", "Jun 13", C.sage, "Entered"],
    ["Red River Breakaway", "Marietta, OK", "Jul 4", C.sage, "Open"],
  ] as const;
  return (
    <SceneFrame bg={C.paper} caption={<Caption eyebrow="The Draw" title="Every event. One feed." tone={C.ink} />}>
      <Phone>
        <div style={screenEyebrow}>THE DRAW</div>
        <div style={screenTitle}>This weekend</div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {["All", "Barrels", "Breakaway"].map((t, i) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                background: i === 0 ? C.rust : "rgba(43,29,18,0.06)",
                color: i === 0 ? C.bone : "rgba(43,29,18,0.6)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
        {events.map((e, i) => (
          <Row key={e[0]} delay={10 + i * 8}>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>{e[0]}</div>
                  <div style={{ fontSize: 11, color: "rgba(43,29,18,0.5)" }}>{e[1]}</div>
                </div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, color: C.rust }}>{e[2]}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: e[3] }}>{e[4]}</span>
            </div>
          </Row>
        ))}
      </Phone>
    </SceneFrame>
  );
}

function BuckleScene() {
  return (
    <SceneFrame bg={C.ink} caption={<Caption eyebrow="The Buckle Board" title="Know where they stand." />}>
      <Phone>
        <div style={screenEyebrow}>THE BUCKLE BOARD</div>
        <div style={screenTitle}>Road to the buckle</div>
        <div style={{ ...card, background: C.ink, color: C.bone }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: C.gold }}>RYLEE · BARRELS</div>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 26 }}>3rd in District 9</div>
          <div style={{ fontSize: 11, color: "rgba(250,244,232,0.6)", margin: "4px 0 8px" }}>248 / 300 pts</div>
          <Bar pct={82} color={C.gold} delay={14} />
        </div>
        {[
          ["District Rodeos", "done"],
          ["District Finals", "now"],
          ["State Finals", "next"],
        ].map((s, i) => (
          <Row key={s[0]} delay={16 + i * 8}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 20,
                  background: s[1] === "done" ? C.sage : s[1] === "now" ? C.rust : "rgba(43,29,18,0.12)",
                  color: "#fff",
                  fontSize: 11,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {s[1] === "done" ? "✓" : "•"}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{s[0]}</span>
            </div>
          </Row>
        ))}
      </Phone>
    </SceneFrame>
  );
}

function TackScene() {
  return (
    <SceneFrame bg={C.sageDeep} caption={<Caption eyebrow="The Tack Room" title="The horse comes first." />}>
      <Phone>
        <div style={screenEyebrow}>THE TACK ROOM</div>
        <div style={screenTitle}>Dolly</div>
        <div style={{ ...card, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 46, height: 46, borderRadius: 46, background: C.saddle, color: C.bone, fontFamily: DISPLAY, fontWeight: 700, fontSize: 22, display: "grid", placeItems: "center" }}>D</div>
          <div>
            <div style={{ fontWeight: 700, color: C.ink }}>Sorrel QH · 9</div>
            <div style={{ fontSize: 11, color: "rgba(43,29,18,0.5)" }}>Barrel mare</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {[["Farrier", "9 days", C.rust], ["Vet", "41 days", C.sageDeep]].map((d, i) => (
            <Row key={d[0]} delay={14 + i * 6}>
              <div style={{ ...card, marginTop: 0, width: 110 }}>
                <div style={{ fontSize: 10, color: "rgba(43,29,18,0.45)" }}>{d[0]}</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, color: d[2] }}>{d[1]}</div>
              </div>
            </Row>
          ))}
        </div>
        <Row delay={26}>
          <div style={card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>Last run · Glen Rose</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "rgba(43,29,18,0.55)" }}>Barrels</span>
              <span style={{ fontFamily: DISPLAY, fontWeight: 700, color: C.rust }}>14.812 · 1st</span>
            </div>
          </div>
        </Row>
      </Phone>
    </SceneFrame>
  );
}

function SponsorScene() {
  const frame = useCurrentFrame();
  const n = Math.round(interpolate(frame, [10, 50], [0, 23], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <SceneFrame bg={C.leather} caption={<Caption eyebrow="The Sponsor Pen" title="Sponsor-ready in a tap." />}>
      <Phone>
        <div style={screenEyebrow}>THE SPONSOR PEN</div>
        <div style={screenTitle}>Media kit</div>
        <div style={{ ...card, background: `linear-gradient(135deg, ${C.leather}, ${C.ink})`, color: C.bone }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18 }}>Rylee Hollis</div>
              <div style={{ fontSize: 10, color: C.gold }}>Barrels · Breakaway · #117</div>
            </div>
            <Rowel size={28} color={C.gold} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {[[n, "events"], [4, "buckles"], ["6.8k", "miles"]].map((s) => (
              <div key={s[1] as string} style={{ flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "8px 0", textAlign: "center" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18 }}>{s[0]}</div>
                <div style={{ fontSize: 8, letterSpacing: 2, color: "rgba(250,244,232,0.6)" }}>{(s[1] as string).toUpperCase()}</div>
              </div>
            ))}
          </div>
        </div>
      </Phone>
    </SceneFrame>
  );
}

function GatepostScene() {
  return (
    <SceneFrame bg={C.rust} caption={<Caption eyebrow="The Gatepost" title="Fight for the arena." />}>
      <Phone>
        <div style={screenEyebrow}>THE GATEPOST</div>
        <div style={screenTitle}>Stand the ground</div>
        <div style={{ ...card, border: `1px solid ${C.rust}`, background: "rgba(184,80,43,0.05)" }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: C.bone, background: C.rust, padding: "3px 8px", borderRadius: 20 }}>
            THREATENED
          </span>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, color: C.ink, marginTop: 8 }}>
            Jackson Hole Rodeo Grounds
          </div>
          <div style={{ fontSize: 11, color: "rgba(43,29,18,0.55)" }}>80 years · rezoning fight</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: "rgba(43,29,18,0.6)", margin: "10px 0 4px" }}>
            <span>1,340 signatures</span>
            <span>goal 5,000</span>
          </div>
          <Bar pct={27} color={C.rust} delay={14} />
          <div style={{ marginTop: 10, background: C.ink, color: C.bone, textAlign: "center", borderRadius: 20, padding: "8px 0", fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
            ADD MY NAME
          </div>
        </div>
      </Phone>
    </SceneFrame>
  );
}

function Outro() {
  const r = useEnter(0, { damping: 12 });
  const t = useEnter(10);
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.ink, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `rotate(${interpolate(frame, [0, 180], [0, 90])}deg)`, opacity: r }}>
        <Rowel size={90} color={C.gold} />
      </div>
      <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 72, color: C.bone, marginTop: 20, opacity: t }}>
        Make it count.
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 26, color: C.wheat, marginTop: 8, opacity: t }}>
        See the live, seeded demo — free.
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          textTransform: "uppercase",
          letterSpacing: 6,
          fontSize: 22,
          color: C.ink,
          background: C.gold,
          padding: "14px 32px",
          borderRadius: 40,
          marginTop: 30,
          opacity: t,
        }}
      >
        8s.rodeo
      </div>
    </AbsoluteFill>
  );
}

/* ============================ COMPOSITION ============================ */
export const DemoVideo: React.FC<{ audioSrc?: string | null }> = ({ audioSrc }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      {audioSrc ? <Audio src={audioSrc} /> : null}
      <Sequence durationInFrames={90}><Intro /></Sequence>
      <Sequence from={90} durationInFrames={135}><DrawScene /></Sequence>
      <Sequence from={225} durationInFrames={135}><BuckleScene /></Sequence>
      <Sequence from={360} durationInFrames={135}><TackScene /></Sequence>
      <Sequence from={495} durationInFrames={135}><SponsorScene /></Sequence>
      <Sequence from={630} durationInFrames={135}><GatepostScene /></Sequence>
      <Sequence from={765} durationInFrames={195}><Outro /></Sequence>
    </AbsoluteFill>
  );
};
