import { AnimatePresence, motion } from "framer-motion";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { DemoProvider, isUnlocked, useDemo } from "../lib/demo";
import { cn, Rowel, Wordmark } from "../components/ui";
import { DemoGate } from "../marketing/DemoGate";
import { TodayScreen, DrawScreen, BuckleScreen, TackScreen } from "./screens";
import { MoreScreen, SponsorScreen, GatepostScreen, ImportScreen, BudgetScreen } from "./screens_more";

const TABS = [
  { to: "/app", label: "Today", icon: HomeIcon, end: true },
  { to: "/app/draw", label: "Draw", icon: CalIcon },
  { to: "/app/buckle", label: "Buckle", icon: TrophyIcon },
  { to: "/app/tack", label: "Tack", icon: HorseIcon },
  { to: "/app/more", label: "More", icon: GridIcon },
];

export default function DemoApp() {
  if (!isUnlocked()) return <LockedScreen />;
  return (
    <DemoProvider>
      <Shell />
    </DemoProvider>
  );
}

function Shell() {
  const { loading, error } = useDemo();
  const location = useLocation();
  return (
    <div className="relative mx-auto flex min-h-[100svh] max-w-md flex-col bg-bone shadow-[0_0_80px_rgba(43,29,18,0.12)]">
      <TopBar />
      <main className="relative flex-1 px-4 pb-28 pt-4">
        {loading && <LoadingState />}
        {error && <div className="rounded-2xl bg-rust/10 p-4 text-sm text-rust">Couldn't load the demo: {error}</div>}
        {!loading && !error && (
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              <Routes location={location}>
                <Route path="/" element={<TodayScreen />} />
                <Route path="/draw" element={<DrawScreen />} />
                <Route path="/buckle" element={<BuckleScreen />} />
                <Route path="/tack" element={<TackScreen />} />
                <Route path="/more" element={<MoreScreen />} />
                <Route path="/sponsor" element={<SponsorScreen />} />
                <Route path="/gatepost" element={<GatepostScreen />} />
                <Route path="/import" element={<ImportScreen />} />
                <Route path="/budget" element={<BudgetScreen />} />
                <Route path="*" element={<TodayScreen />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function TopBar() {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-saddle/12 bg-bone/85 px-4 py-3 backdrop-blur-md">
      <Wordmark className="scale-90 origin-left" />
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-gold/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-saddle">Demo</span>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-saddle font-display text-sm font-bold text-bone">H</span>
      </div>
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md tap-safe">
      <div className="mx-3 mb-3 flex items-center justify-around rounded-2xl border border-saddle/15 bg-bone/95 px-1 py-1.5 shadow-lift backdrop-blur-md">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition",
                isActive ? "text-rust" : "text-ink/45 hover:text-ink/70",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span layoutId="navpill" className="absolute inset-0 rounded-xl bg-rust/8" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                )}
                <t.icon className="relative h-5 w-5" />
                <span className="relative">{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function LoadingState() {
  return (
    <div className="grid place-items-center py-32">
      <Rowel className="h-9 w-9 animate-spin text-rust [animation-duration:1.4s]" />
    </div>
  );
}

function LockedScreen() {
  return (
    <div className="relative grid min-h-[100svh] place-items-center bg-leather p-4 text-bone">
      <div className="absolute inset-0 grain dark-grain" />
      <DemoGate open={true} onClose={() => (window.location.href = "/")} />
      <div className="relative text-center opacity-60">
        <Rowel className="mx-auto h-12 w-12 text-gold" />
        <p className="mt-4 font-display uppercase tracking-widest">Unlocking the demo…</p>
      </div>
    </div>
  );
}

/* ---- icons ---- */
type IP = { className?: string };
function HomeIcon({ className }: IP) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-8 9 8M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function CalIcon({ className }: IP) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round"/></svg>; }
function TrophyIcon({ className }: IP) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4h12v4a6 6 0 01-12 0V4zM6 6H3v1a4 4 0 004 4M18 6h3v1a4 4 0 01-4 4M9 20h6M12 14v6" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function HorseIcon({ className }: IP) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19l2-7 3-3 2 2 4-6 1 4 3 2-2 2-2-1-2 3 1 4M4 19h4" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function GridIcon({ className }: IP) { return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>; }
