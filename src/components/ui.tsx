import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* --- Spur rowel logo mark ------------------------------------------------- */
export function Rowel({ className = "" }: { className?: string }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 11 : 5.2;
    return `${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <polygon points={points} fill="currentColor" />
      <circle cx="12" cy="12" r="3.1" fill="var(--color-bone)" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({
  className = "",
  tone = "ink",
}: {
  className?: string;
  tone?: "ink" | "bone";
}) {
  const color = tone === "bone" ? "text-bone" : "text-ink";
  return (
    <Link to="/" className={cn("group inline-flex items-center gap-2.5", color, className)}>
      <span className="relative grid h-9 w-9 place-items-center">
        <Rowel className="h-9 w-9 text-rust transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:rotate-180" />
        <span className="absolute font-western text-[13px] leading-none text-bone">8</span>
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl font-bold tracking-tight">8&nbsp;SECONDS</span>
        <span className="eyebrow mt-0.5 text-[9px] tracking-[0.42em] opacity-60">8s.rodeo</span>
      </span>
    </Link>
  );
}

/* --- Scroll reveal -------------------------------------------------------- */
export function Reveal({
  children,
  delay = 0,
  y = 26,
  className = "",
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* --- Animated counter ----------------------------------------------------- */
export function Counter({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: 1600, bounce: 0 });
  const text = useTransform(spring, (v) =>
    `${prefix}${v.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`,
  );
  useEffect(() => {
    if (inView) mv.set(to);
  }, [inView, to, mv]);
  return <motion.span ref={ref}>{text}</motion.span>;
}

/* --- Buttons -------------------------------------------------------------- */
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-display font-semibold uppercase tracking-wider transition-all duration-300 ease-[var(--ease-out-soft)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2";

const sizes = {
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
  sm: "px-4 py-2 text-xs",
};

type Variant = "primary" | "ghost" | "outline" | "bone";

const variants: Record<Variant, string> = {
  primary:
    "bg-rust text-bone shadow-[0_10px_30px_-10px_rgba(184,80,43,0.7)] hover:bg-ember hover:-translate-y-0.5",
  bone: "bg-bone text-ink hover:bg-white hover:-translate-y-0.5 shadow-card",
  outline: "border border-saddle/40 text-ink hover:border-saddle hover:bg-saddle/5",
  ghost: "text-ink/70 hover:text-ink",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={cn(btnBase, sizes[size], variants[variant], className)} {...props} />;
}

export function LinkButton({
  to,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: keyof typeof sizes;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(btnBase, sizes[size], variants[variant], className)}>
      {children}
    </Link>
  );
}

/* --- Tag / pill ----------------------------------------------------------- */
export function Tag({
  children,
  tone = "sage",
  className = "",
}: {
  children: ReactNode;
  tone?: "sage" | "rust" | "gold" | "turq" | "ink";
  className?: string;
}) {
  const tones: Record<string, string> = {
    sage: "bg-sage/15 text-sage-deep",
    rust: "bg-rust/12 text-rust",
    gold: "bg-gold/20 text-saddle",
    turq: "bg-turq/12 text-turq",
    ink: "bg-ink/8 text-ink/70",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --- Grain overlay (drop into a `relative` container) --------------------- */
export function Grain({ dark = false }: { dark?: boolean }) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden grain", dark && "dark-grain")} />
  );
}
