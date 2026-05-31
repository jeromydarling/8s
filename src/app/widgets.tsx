import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "../components/ui";

export function ScreenHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-saddle/70">{eyebrow}</div>
        <h1 className="mt-1 font-display text-3xl font-bold leading-none text-ink">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cn("card relative overflow-hidden p-4", onClick && "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lift", className)}>
      {children}
    </div>
  );
}

export function Stagger({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-3"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
      transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ProgressBar({ pct, tone = "rust" }: { pct: number; tone?: "rust" | "gold" | "sage" | "turq" }) {
  const fill = { rust: "bg-rust", gold: "bg-gold", sage: "bg-sage", turq: "bg-turq" }[tone];
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/8">
      <motion.div
        className={cn("h-full rounded-full", fill)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function Avatar({ seed, name, size = 44 }: { seed: string; name: string; size?: number }) {
  // deterministic warm gradient from the seed
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const c1 = `hsl(${20 + (h % 40)} 55% 55%)`;
  const c2 = `hsl(${30 + (h % 60)} 45% 38%)`;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-display font-bold text-bone"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${c1}, ${c2})`, fontSize: size * 0.4 }}
    >
      {name.charAt(0)}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    safe: "bg-sage", saved: "bg-turq", watch: "bg-gold", threatened: "bg-rust",
    "on-track": "bg-sage", "at-risk": "bg-gold", qualified: "bg-turq",
    open: "bg-sage", "closing-soon": "bg-rust", drawn: "bg-turq", closed: "bg-ink/30",
  };
  return <span className={cn("inline-block h-2 w-2 rounded-full", map[status] ?? "bg-ink/30")} />;
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-saddle/30 bg-paper/60 p-6 text-center text-sm text-ink/50">{children}</div>;
}

export function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function daysUntil(iso: string) {
  const now = new Date("2026-05-31T00:00:00").getTime();
  return Math.round((new Date(iso + "T00:00:00").getTime() - now) / 86400000);
}
