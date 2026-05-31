import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { artUrl } from "../lib/api";
import { Button, Counter, Grain, Reveal, Rowel, Tag, Wordmark } from "../components/ui";
import { DemoGate } from "./DemoGate";
import {
  BucklePreview,
  DrawPreview,
  GatepostPreview,
  PhoneFrame,
  SponsorPreview,
  TackRoomPreview,
} from "./MiniApp";

export default function Home() {
  const [gate, setGate] = useState(false);
  const openGate = () => setGate(true);

  return (
    <div className="relative bg-bone">
      <Nav onDemo={openGate} />
      <Hero onDemo={openGate} />
      <StatStrip />
      <WhySection />
      <GapSection />
      <FeaturesSection onDemo={openGate} />
      <WomenSection />
      <ImportSection />
      <CommunitySection />
      <PricingSection onDemo={openGate} />
      <DemoBand onDemo={openGate} />
      <Footer />
      <DemoGate open={gate} onClose={() => setGate(false)} />
    </div>
  );
}

/* ============================ NAV ============================ */
function Nav({ onDemo }: { onDemo: () => void }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
        solid ? "bg-bone/90 py-2.5 shadow-[0_1px_0_rgba(138,90,59,0.15)] backdrop-blur-md" : "py-4"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5">
        <Wordmark tone={solid ? "ink" : "ink"} />
        <nav className="hidden items-center gap-7 font-display text-sm font-semibold uppercase tracking-wider text-ink/70 md:flex">
          <a href="#why" className="transition hover:text-rust">Why</a>
          <a href="#features" className="transition hover:text-rust">The App</a>
          <a href="#community" className="transition hover:text-rust">Community</a>
          <a href="#pricing" className="transition hover:text-rust">Pricing</a>
        </nav>
        <Button size="sm" onClick={onDemo} className="!px-5">See the demo</Button>
      </div>
    </header>
  );
}

/* ============================ HERO ============================ */
function Hero({ onDemo }: { onDemo: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yBack = useTransform(scrollYProgress, [0, 1], ["0%", "26%"]);
  const yArt = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section ref={ref} className="relative flex min-h-[100svh] flex-col overflow-hidden bg-leather text-bone">
      {/* watercolor sky */}
      <motion.div
        style={{ y: yBack, backgroundImage: `url(${artUrl("hero")})` }}
        className="absolute inset-0 bg-cover bg-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/55 via-transparent to-leather" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/40 to-transparent" />

      {/* drifting clouds */}
      <motion.div style={{ y: yArt }} className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-[22%] flex w-[200%] gap-40 opacity-30 animate-drift">
          {[0, 1].map((k) => (
            <CloudRow key={k} />
          ))}
        </div>
      </motion.div>

      <Grain dark />

      <motion.div
        style={{ opacity: fade }}
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 pt-28 pb-16"
      >
        <Reveal>
          <span className="eyebrow text-gold">Youth rodeo · all in one place</span>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-4 max-w-4xl font-display font-bold leading-[0.92] display-xl">
            Make every <span className="text-shimmer">eight seconds</span> count.
          </h1>
        </Reveal>
        <Reveal delay={0.18}>
          <p className="mt-6 max-w-xl font-serif text-lg leading-relaxed text-bone/80">
            One hub for the whole rodeo family — every event, every qualifying ladder, every horse, and every
            arena worth fighting for. Built for the people who feed before sunrise and drive all night to make
            the draw.
          </p>
        </Reveal>
        <Reveal delay={0.28}>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button size="lg" onClick={onDemo} className="[animation:pulse-ring_2.4s_infinite]">
              See the live demo
            </Button>
            <a
              href="#features"
              className="font-display text-sm font-semibold uppercase tracking-wider text-bone/80 underline-offset-8 transition hover:text-gold hover:underline"
            >
              How it works ↓
            </a>
          </div>
        </Reveal>
        <Reveal delay={0.4}>
          <div className="mt-12 flex items-center gap-3 text-xs text-bone/55">
            <span className="flex -space-x-2">
              {["R", "C", "M"].map((c) => (
                <span key={c} className="grid h-7 w-7 place-items-center rounded-full border border-bone/30 bg-saddle text-[10px] font-bold">
                  {c}
                </span>
              ))}
            </span>
            Built alongside real rodeo families across the Plains.
          </div>
        </Reveal>
      </motion.div>

      {/* 8-second timer motif */}
      <EightTimer />
    </section>
  );
}

function CloudRow() {
  return (
    <svg viewBox="0 0 600 80" className="h-20 w-[50%] shrink-0 text-bone">
      <g fill="currentColor">
        <ellipse cx="120" cy="50" rx="90" ry="20" />
        <ellipse cx="200" cy="42" rx="70" ry="24" />
        <ellipse cx="430" cy="48" rx="110" ry="18" />
        <ellipse cx="520" cy="40" rx="60" ry="22" />
      </g>
    </svg>
  );
}

function EightTimer() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((v) => (v + 0.1 > 8 ? 0 : +(v + 0.1).toFixed(1))), 100);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="relative z-10 mx-auto mb-6 w-full max-w-6xl px-5">
      <div className="flex items-center gap-3 font-display text-bone/70">
        <span className="text-xs uppercase tracking-[0.3em]">The ride</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bone/15">
          <div className="h-full rounded-full bg-gold transition-all duration-100" style={{ width: `${(t / 8) * 100}%` }} />
        </div>
        <span className="w-12 text-right tabular-nums text-gold">{t.toFixed(1)}s</span>
      </div>
    </div>
  );
}

/* ============================ STAT STRIP ============================ */
function StatStrip() {
  const stats = [
    { n: <Counter to={12500} suffix="+" />, l: "NHSRA members across 44 states" },
    { n: <Counter to={37} suffix="%" />, l: "Breakaway roping growth in 2 years" },
    { n: <><Counter prefix="$" to={50} />k</>, l: "A serious family's season spend" },
    { n: <Counter to={70} suffix="%" />, l: "Of entries now driven by women" },
  ];
  return (
    <section className="relative border-y border-saddle/15 bg-paper">
      <Grain />
      <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-px md:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={i} delay={i * 0.08} className="px-5 py-8 text-center md:py-10">
            <div className="font-display text-4xl font-bold text-rust md:text-5xl">{s.n}</div>
            <div className="mx-auto mt-2 max-w-[16ch] text-xs leading-snug text-ink/60">{s.l}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============================ WHY ============================ */
function WhySection() {
  return (
    <section id="why" className="relative mx-auto max-w-6xl px-5 py-24 md:py-32">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <Reveal><span className="eyebrow text-rust">Why we're building this</span></Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-4 display-lg font-bold leading-[0.98] text-ink">
              The most passionate community in sports — and the least served by anyone's software.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-6 space-y-4 font-serif text-lg leading-relaxed text-ink/75">
              <p>
                Rodeo families wake before the sun, haul across three states for a weekend, and pour everything
                they have into a sport measured in tenths of a second. They keep each other's kids fed at the
                trailer and pray over the chutes together.
              </p>
              <p>
                And yet the tools they're handed are a patchwork of spreadsheets, Facebook posts, and notarized
                paper forms mailed to a PO box. The arena is sacred. The software is an afterthought.
              </p>
              <p className="font-semibold text-ink">
                8 Seconds is built the other way around — by a rodeo family, for rodeo families.
              </p>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.15} className="relative">
          <div className="deckle overflow-hidden">
            <img src={artUrl("community")} alt="A watercolor of families gathered at the fairgrounds" className="aspect-[4/5] w-full object-cover" loading="lazy" />
          </div>
          <div className="absolute -bottom-5 -left-5 max-w-[14rem] rotate-[-2deg] rounded-2xl bg-ink p-4 text-bone shadow-lift">
            <p className="font-serif text-sm italic leading-snug">
              "Any app must look and feel like it belongs in a tack room — not a Silicon Valley pitch deck."
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================ GAP ============================ */
function GapSection() {
  const gaps = [
    { t: "No unified calendar", d: "Events are scattered across a dozen association sites, Facebook groups, and paper flyers.", i: "📅" },
    { t: "No qualifying tracker", d: "Families learn where they stand by calling regional directors and guessing.", i: "🏆" },
    { t: "No family hub", d: "No account spans multiple kids, multiple horses, and multiple associations.", i: "👨‍👩‍👧" },
    { t: "No horse tools", d: "The athlete that costs the most — the horse — has no health or run log anywhere.", i: "🐴" },
    { t: "No advocacy layer", d: "Arenas close to development and noise complaints with no way to organize a fight.", i: "📣" },
    { t: "No media kit", d: "A 16-year-old can't easily show a feed store why she's worth sponsoring.", i: "✨" },
  ];
  return (
    <section className="relative bg-leather py-24 text-bone md:py-32">
      <Grain dark />
      <div className="relative mx-auto max-w-6xl px-5">
        <Reveal><span className="eyebrow text-gold">The gap in the market</span></Reveal>
        <Reveal delay={0.1}>
          <h2 className="mt-4 max-w-3xl display-lg font-bold text-bone">Six holes nobody has filled. We fill all six.</h2>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {gaps.map((g, i) => (
            <Reveal key={g.t} delay={i * 0.06}>
              <div className="group h-full rounded-2xl border border-bone/12 bg-bone/[0.04] p-6 transition hover:border-gold/40 hover:bg-bone/[0.07]">
                <div className="text-3xl">{g.i}</div>
                <h3 className="mt-3 font-display text-xl font-semibold text-gold">{g.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-bone/65">{g.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ FEATURES ============================ */
const MODULES = [
  {
    tag: "The Draw",
    title: "Every event, in one feed",
    body: "The first and only place to see all youth rodeo events — NHSRA, NLBRA, NJHRA, AJRA and your local jackpots — filtered by discipline, age group, and state. Deadline alerts so you never miss a draw again.",
    Preview: DrawPreview,
    accent: "rust" as const,
  },
  {
    tag: "The Buckle Board",
    title: "The road to the buckle, visualized",
    body: "Per-contestant qualifying dashboards across every pathway at once. See exactly where each kid stands, what they need, and how many days are left — no more calling directors to guess.",
    Preview: BucklePreview,
    accent: "gold" as const,
  },
  {
    tag: "The Tack Room",
    title: "The horse is an athlete. We treat it like one.",
    body: "Family accounts that span every kid and every horse. Farrier and vet reminders tied to your event calendar, a run log for footing and notes, and the records that keep your most valuable athlete sound.",
    Preview: TackRoomPreview,
    accent: "sage" as const,
  },
  {
    tag: "The Sponsor Pen",
    title: "A media kit she can send before homework",
    body: "A shareable, branded profile with stats, schedule, and reach — ready to email a feed store. Track logo placements and renewals. The tools rodeo families need and nobody else offers.",
    Preview: SponsorPreview,
    accent: "turq" as const,
  },
  {
    tag: "The Gatepost",
    title: "Fight for the arenas that raised us",
    body: "The first digital organizing tool for rodeo arena preservation. A map of endangered grounds, petition and letter tools, and an economic-impact calculator — so when development comes, families are ready.",
    Preview: GatepostPreview,
    accent: "rust" as const,
  },
];

function FeaturesSection({ onDemo }: { onDemo: () => void }) {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-5 py-24 md:py-32">
      <Reveal className="text-center">
        <span className="eyebrow text-rust">Five rooms under one roof</span>
        <h2 className="mx-auto mt-4 max-w-3xl display-lg font-bold text-ink">
          One app for the whole family, across every discipline.
        </h2>
      </Reveal>

      <div className="mt-20 space-y-28">
        {MODULES.map((m, i) => {
          const flip = i % 2 === 1;
          return (
            <div key={m.tag} className="grid items-center gap-12 md:grid-cols-2">
              <Reveal className={flip ? "md:order-2" : ""} y={40}>
                <div className="flex justify-center">
                  <PhoneFrame label={m.tag}>
                    <m.Preview />
                  </PhoneFrame>
                </div>
              </Reveal>
              <Reveal delay={0.1} className={flip ? "md:order-1" : ""}>
                <Tag tone={m.accent}>Module {i + 1}</Tag>
                <h3 className="mt-3 font-display text-3xl font-bold leading-tight text-ink md:text-4xl">{m.title}</h3>
                <p className="mt-4 font-serif text-lg leading-relaxed text-ink/70">{m.body}</p>
                <button
                  onClick={onDemo}
                  className="mt-6 font-display text-sm font-semibold uppercase tracking-wider text-rust underline-offset-8 transition hover:underline"
                >
                  Try {m.tag} in the demo →
                </button>
              </Reveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ============================ WOMEN / BREAKAWAY ============================ */
function WomenSection() {
  return (
    <section className="relative overflow-hidden bg-ink py-24 text-bone md:py-32">
      <Grain dark />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 md:grid-cols-2">
        <Reveal y={40} className="order-1">
          <figure className="relative">
            <div className="deckle overflow-hidden shadow-lift">
              <img
                src={artUrl("barrelracer")}
                alt="A vintage watercolor of a cowgirl and her horse rounding the final barrel at a full run in a rodeo arena"
                className="aspect-[5/4] w-full object-cover"
                loading="lazy"
              />
            </div>
            <figcaption className="absolute -bottom-4 right-4 rotate-[1.5deg] rounded-full bg-gold px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink shadow-lg">
              Eight seconds of try
            </figcaption>
          </figure>
        </Reveal>
        <div className="order-2 max-w-xl">
          <Reveal><span className="eyebrow text-gold">Women and girls at the center</span></Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-4 display-lg font-bold leading-[0.98]">
              The fastest-growing sport in rodeo is hers.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 font-serif text-lg leading-relaxed text-bone/80">
              Breakaway roping and barrel racing are exploding — and they're driven by daughters who learned in
              local arenas. We don't treat them as an afterthought. They're the power users, and the whole app is
              designed around them.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-3 gap-6">
            {[
              ["$2.09M", "Top-20 breakaway earnings, 2025"],
              ["70%", "Of entries driven by women"],
              ["#1", "Fastest-growing event in rodeo"],
            ].map(([n, l]) => (
              <Reveal key={l}>
                <div className="font-display text-3xl font-bold text-gold">{n}</div>
                <div className="mt-1 text-xs leading-snug text-bone/55">{l}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ AI IMPORT ============================ */
function ImportSection() {
  const lines = [
    "Rylee,Dolly,Glen Rose,Barrels,14.812,1st",
    "Rylee,Boomer,Glen Rose,Breakaway,2.61,3rd",
    "Cade,Chex,Lone Star,Tie-Down,11.9,2nd",
  ];
  return (
    <section className="relative mx-auto max-w-6xl px-5 py-24 md:py-28">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <Reveal>
          <Tag tone="turq">Powered by Cloudflare AI</Tag>
          <h2 className="mt-3 display-lg font-bold leading-[0.98] text-ink">Bring years of data. In any format.</h2>
          <p className="mt-5 font-serif text-lg leading-relaxed text-ink/70">
            Got a decade of run times in a spreadsheet, an old email thread, or a copied results page? Paste it
            in. Our AI reads the mess, recognizes riders, horses, events and times, and turns it into clean
            records — so your whole history comes with you on day one.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-ink/70">
            {["CSV, spreadsheets, copied tables, hand-typed notes", "Auto-detects contestants, horses, events, and runs", "Synthesizes and de-duplicates — you just confirm"].map((x) => (
              <li key={x} className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-turq/15 text-turq">✓</span>
                {x}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="overflow-hidden rounded-2xl border border-saddle/20 bg-leather shadow-lift">
            <div className="flex items-center gap-2 border-b border-bone/10 px-4 py-3 text-bone/60">
              <Rowel className="h-4 w-4 text-gold" />
              <span className="text-xs font-semibold uppercase tracking-widest">Import · paste anything</span>
            </div>
            <pre className="overflow-x-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-bone/70">
{lines.join("\n")}
            </pre>
            <div className="border-t border-bone/10 bg-ink/40 px-4 py-3">
              <div className="mb-2 text-[10px] uppercase tracking-widest text-gold">AI synthesized →</div>
              <div className="space-y-1.5">
                {[
                  ["run", "Rylee · Dolly · Barrels · 14.812 · 1st"],
                  ["run", "Rylee · Boomer · Breakaway · 2.61 · 3rd"],
                  ["run", "Cade · Chex · Tie-Down · 11.9 · 2nd"],
                ].map(([type, text], i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.15 }}
                    className="flex items-center gap-2 rounded-lg bg-bone/5 px-2.5 py-1.5 text-[11px] text-bone/80"
                  >
                    <span className="rounded bg-turq/25 px-1.5 py-0.5 text-[9px] font-bold uppercase text-turq-light">{type}</span>
                    {text}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================ COMMUNITY MANIFESTO ============================ */
function CommunitySection() {
  return (
    <section id="community" className="relative overflow-hidden bg-paper py-24 md:py-32">
      <Grain />
      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <Reveal><Rowel className="mx-auto h-10 w-10 text-rust" /></Reveal>
        <Reveal delay={0.1}>
          <span className="eyebrow mt-6 block text-rust">What we believe</span>
        </Reveal>
        <Reveal delay={0.18}>
          <p className="mt-6 font-serif text-2xl leading-snug text-ink md:text-[2rem]">
            No family should have to do this alone. We show up for each other at the trailer, hold the gate for
            the next kid, and keep the lights on at the arena that raised us.
          </p>
        </Reveal>
        <Reveal delay={0.28}>
          <p className="mx-auto mt-8 max-w-xl font-serif text-lg leading-relaxed text-ink/70">
            8 Seconds is a tool, but it's built on an older idea: that a community is something you tend
            together. Every feature here exists to give families more time with each other and more strength when
            it counts — in the alley, on the road, and when the arena needs defending.
          </p>
        </Reveal>
        <Reveal delay={0.36}>
          <p className="mt-10 font-display text-sm font-semibold uppercase tracking-[0.3em] text-saddle">
            Feed before sunrise · Ride like it's the last eight seconds
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================ PRICING ============================ */
function PricingSection({ onDemo }: { onDemo: () => void }) {
  const tiers = [
    { name: "Free", price: "$0", note: "Every family", feats: ["The Draw event feed", "The Gatepost advocacy", "Basic horse profile"], cta: "Start free", hot: false },
    { name: "Arena Family", price: "$79", per: "/yr", note: "Competitive families", feats: ["Unlimited kids + horses", "The Buckle Board", "The Tack Room + reminders", "Budget tracker"], cta: "Go Family", hot: true },
    { name: "Arena Pro", price: "$19.99", per: "/mo", note: "Serious competitors", feats: ["Everything in Family", "The Sponsor Pen toolkit", "Media-kit generator", "Sponsor recap reports"], cta: "Go Pro", hot: false },
  ];
  return (
    <section id="pricing" className="relative mx-auto max-w-6xl px-5 py-24 md:py-28">
      <Reveal className="text-center">
        <span className="eyebrow text-rust">Honest pricing</span>
        <h2 className="mx-auto mt-4 max-w-2xl display-lg font-bold text-ink">Built to be worth it for a $15k-a-year season.</h2>
      </Reveal>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {tiers.map((t, i) => (
          <Reveal key={t.name} delay={i * 0.08}>
            <div
              className={`relative flex h-full flex-col rounded-3xl border p-7 transition ${
                t.hot ? "border-rust bg-leather text-bone shadow-lift" : "border-saddle/20 bg-bone text-ink shadow-card"
              }`}
            >
              {t.hot && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
                  Most families
                </span>
              )}
              <div className={`text-xs font-semibold uppercase tracking-widest ${t.hot ? "text-gold" : "text-saddle/70"}`}>{t.note}</div>
              <div className="mt-1 font-display text-2xl font-bold">{t.name}</div>
              <div className="mt-3 flex items-end gap-1">
                <span className="font-display text-4xl font-bold">{t.price}</span>
                {t.per && <span className={`pb-1 text-sm ${t.hot ? "text-bone/60" : "text-ink/50"}`}>{t.per}</span>}
              </div>
              <ul className={`mt-5 flex-1 space-y-2.5 text-sm ${t.hot ? "text-bone/80" : "text-ink/70"}`}>
                {t.feats.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${t.hot ? "bg-gold/20 text-gold" : "bg-sage/15 text-sage-deep"}`}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Button onClick={onDemo} variant={t.hot ? "bone" : "outline"} className="mt-7 w-full">{t.cta}</Button>
            </div>
          </Reveal>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-ink/50">
        Associations: event management, member database and draw tools from $49/mo. Brand partnerships available.
      </p>
    </section>
  );
}

/* ============================ DEMO BAND ============================ */
function DemoBand({ onDemo }: { onDemo: () => void }) {
  return (
    <section className="relative overflow-hidden bg-rust py-20 text-bone">
      <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${artUrl("trail")})` }} />
      <Grain dark />
      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <Reveal>
          <h2 className="display-lg font-bold leading-[0.98]">See the whole season, seeded and ready.</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-4 max-w-xl font-serif text-lg text-bone/85">
            Step into the Hollis family's real-feeling demo — events, ladders, horses, sponsors and arenas, all
            wired up. Takes ten seconds.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <Button onClick={onDemo} variant="bone" size="lg" className="mt-8">Open the live demo →</Button>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================ FOOTER ============================ */
function Footer() {
  return (
    <footer className="relative bg-hide py-14 text-bone/70">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div className="max-w-xs">
            <Wordmark tone="bone" />
            <p className="mt-4 text-sm leading-relaxed text-bone/55">
              The hub built by a rodeo family, for rodeo families. Every event, every ladder, every horse — and
              every arena worth fighting for.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
            {[
              ["Product", ["The Draw", "Buckle Board", "Tack Room", "Sponsor Pen", "Gatepost"]],
              ["Company", ["Why 8 Seconds", "Community", "Pricing", "Associations"]],
              ["Reach us", ["hello@8s.rodeo", "Stephenville, TX"]],
            ].map(([h, items]) => (
              <div key={h as string}>
                <div className="mb-3 font-display text-xs font-semibold uppercase tracking-widest text-gold">{h as string}</div>
                <ul className="space-y-1.5 text-bone/55">
                  {(items as string[]).map((it) => (
                    <li key={it} className="transition hover:text-bone">{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-bone/10 pt-6 text-xs text-bone/40 sm:flex-row">
          <span>© {new Date().getFullYear()} 8 Seconds · 8s.rodeo</span>
          <span>Made for the people who feed before sunrise.</span>
        </div>
      </div>
    </footer>
  );
}
