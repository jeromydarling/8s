import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Rowel } from "../components/ui";

/* Chromeless device frame — a clean, bezel-only "screenshot" surface so the
   mini React previews read as the real app, mobile-first. */
export function PhoneFrame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="relative mx-auto w-[270px] select-none">
      <div className="rounded-[2.6rem] bg-leather p-2.5 shadow-[0_40px_80px_-30px_rgba(43,29,18,0.6)] ring-1 ring-black/20">
        <div className="relative overflow-hidden rounded-[2.1rem] bg-bone">
          {/* status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1 text-[10px] font-semibold text-ink/60">
            <span>8:08</span>
            <span className="flex items-center gap-1">
              <Rowel className="h-3 w-3 text-rust" /> 8s
            </span>
            <span>▮▮▮</span>
          </div>
          <div className="h-[460px] overflow-hidden px-3 pb-4">{children}</div>
        </div>
      </div>
      {label && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-bone shadow-lg">
          {label}
        </div>
      )}
    </div>
  );
}

function Bar({ pct, tone = "rust" }: { pct: number; tone?: "rust" | "gold" | "sage" }) {
  const fill = tone === "gold" ? "bg-gold" : tone === "sage" ? "bg-sage" : "bg-rust";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink/8">
      <motion.div
        className={`h-full rounded-full ${fill}`}
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

const head = "mb-2 flex items-center justify-between";
const title = "font-display text-lg font-semibold text-ink";
const sub = "text-[10px] uppercase tracking-[0.25em] text-saddle/70";

/* ---- The Draw ---- */
export function DrawPreview() {
  const events = [
    { n: "Cross Timbers Youth Rodeo", w: "Stephenville, TX", d: "Jun 6", tag: "Closes in 3d", hot: true },
    { n: "NHSRA Texas State Finals", w: "Fort Worth, TX", d: "Jun 13", tag: "Entered" },
    { n: "Red River Breakaway Classic", w: "Marietta, OK", d: "Jul 4", tag: "Open" },
  ];
  return (
    <div>
      <div className={head}>
        <div>
          <div className={sub}>The Draw</div>
          <div className={title}>Every event, one feed</div>
        </div>
      </div>
      <div className="mb-3 flex gap-1.5 overflow-hidden text-[9px] font-semibold">
        {["All", "Barrels", "Breakaway", "Roping"].map((f, i) => (
          <span key={f} className={`rounded-full px-2 py-1 ${i === 0 ? "bg-rust text-bone" : "bg-ink/6 text-ink/60"}`}>
            {f}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        {events.map((e, i) => (
          <motion.div
            key={e.n}
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 * i }}
            className="rounded-2xl border border-saddle/15 bg-white/60 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[13px] font-semibold leading-tight text-ink">{e.n}</div>
                <div className="text-[10px] text-ink/50">{e.w}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-sm font-bold text-rust">{e.d}</div>
              </div>
            </div>
            <div className="mt-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                  e.hot ? "bg-rust/12 text-rust" : "bg-sage/15 text-sage-deep"
                }`}
              >
                {e.tag}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---- The Buckle Board ---- */
export function BucklePreview() {
  return (
    <div>
      <div className={head}>
        <div>
          <div className={sub}>The Buckle Board</div>
          <div className={title}>Road to the buckle</div>
        </div>
      </div>
      <div className="rounded-2xl bg-ink p-4 text-bone">
        <div className="text-[10px] uppercase tracking-widest text-gold">Rylee · Barrels</div>
        <div className="mb-1 font-display text-2xl font-bold">3rd in District 9</div>
        <div className="mb-2 text-[10px] text-bone/60">248 / 300 pts to State Finals</div>
        <Bar pct={82} tone="gold" />
      </div>
      <div className="mt-3 space-y-2.5">
        {[
          { l: "District Rodeos", s: "done", d: "8 of 10 counted" },
          { l: "District Finals", s: "now", d: "3rd — top 4 advance" },
          { l: "State Finals", s: "next", d: "Fort Worth · Jun 13" },
          { l: "Nationals (NHSFR)", s: "next", d: "Rock Springs, WY" },
        ].map((st) => (
          <div key={st.l} className="flex items-center gap-3">
            <span
              className={`grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold ${
                st.s === "done"
                  ? "bg-sage text-white"
                  : st.s === "now"
                    ? "bg-rust text-white [animation:pulse-ring_1.8s_infinite]"
                    : "bg-ink/10 text-ink/40"
              }`}
            >
              {st.s === "done" ? "✓" : "•"}
            </span>
            <div className="flex-1 border-b border-dashed border-ink/10 pb-1.5">
              <div className="text-[12px] font-semibold text-ink">{st.l}</div>
              <div className="text-[10px] text-ink/45">{st.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- The Tack Room ---- */
export function TackRoomPreview() {
  return (
    <div>
      <div className={head}>
        <div>
          <div className={sub}>The Tack Room</div>
          <div className={title}>The horse comes first</div>
        </div>
      </div>
      <div className="rounded-2xl border border-saddle/15 bg-gradient-to-br from-clay/40 to-bone p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-saddle text-lg font-western text-bone">
            D
          </div>
          <div>
            <div className="font-display text-base font-bold text-ink">Dolly</div>
            <div className="text-[10px] text-ink/50">Sorrel QH · 9 · Barrel mare</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl bg-white/70 p-2">
            <div className="text-ink/45">Farrier due</div>
            <div className="font-display text-sm font-bold text-rust">9 days</div>
          </div>
          <div className="rounded-xl bg-white/70 p-2">
            <div className="text-ink/45">Coggins / vet</div>
            <div className="font-display text-sm font-bold text-sage-deep">41 days</div>
          </div>
        </div>
      </div>
      <div className="mt-2.5 rounded-2xl border border-saddle/15 bg-white/60 p-3 text-[11px]">
        <div className="mb-1 font-semibold text-ink">Last run · Glen Rose</div>
        <div className="flex items-center justify-between">
          <span className="text-ink/55">Barrels · deep ground</span>
          <span className="font-display text-base font-bold text-rust">14.812 · 1st</span>
        </div>
      </div>
    </div>
  );
}

/* ---- The Sponsor Pen ---- */
export function SponsorPreview() {
  return (
    <div>
      <div className={head}>
        <div>
          <div className={sub}>The Sponsor Pen</div>
          <div className={title}>Media kit, ready to send</div>
        </div>
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-leather to-ink p-4 text-bone">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-lg font-bold">Rylee Hollis</div>
            <div className="text-[10px] text-gold">Barrels · Breakaway · #117</div>
          </div>
          <Rowel className="h-7 w-7 text-gold" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["23", "events"],
            ["4", "buckles"],
            ["6.8k", "miles"],
          ].map(([n, l]) => (
            <div key={l} className="rounded-xl bg-white/10 py-2">
              <div className="font-display text-base font-bold">{n}</div>
              <div className="text-[8px] uppercase tracking-widest text-bone/60">{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2.5 space-y-2">
        {[
          ["Lone Star Feed & Supply", "Gold", "4/6 done"],
          ["Bar-H Saddlery", "Silver", "Renewal due"],
        ].map(([b, t]) => (
          <div key={b} className="flex items-center justify-between rounded-xl border border-saddle/15 bg-white/60 p-2.5 text-[11px]">
            <span className="font-semibold text-ink">{b}</span>
            <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[9px] font-semibold text-saddle">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- The Gatepost ---- */
export function GatepostPreview() {
  return (
    <div>
      <div className={head}>
        <div>
          <div className={sub}>The Gatepost</div>
          <div className={title}>Fight for the arena</div>
        </div>
      </div>
      <div className="rounded-2xl border border-rust/30 bg-rust/5 p-3">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-rust px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-bone">
            Threatened
          </span>
          <span className="text-[10px] text-ink/45">Jackson, WY</span>
        </div>
        <div className="mt-2 font-display text-base font-bold leading-tight text-ink">
          Jackson Hole Rodeo Grounds
        </div>
        <div className="text-[10px] text-ink/55">80 years · rezoning for housing</div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] font-semibold text-ink/60">
            <span>1,340 signatures</span>
            <span>goal 5,000</span>
          </div>
          <Bar pct={27} tone="rust" />
        </div>
        <button className="mt-3 w-full rounded-full bg-ink py-2 text-[11px] font-semibold uppercase tracking-wider text-bone">
          Add my name
        </button>
      </div>
      <div className="mt-2.5 rounded-2xl bg-sage/10 p-3 text-[11px]">
        <div className="font-semibold text-sage-deep">Sand Springs, OK · Saved ✓</div>
        <div className="text-ink/55">Families packed the council. The arena stayed open.</div>
      </div>
    </div>
  );
}
