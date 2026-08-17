// Hand-rolled stroke icons — no icon library, no external requests.
// All inherit currentColor so they recolor with the theme.

import type { ReactNode } from 'react';
import type { Item } from '../shared/protocol';

function I({ children, size = 20, label }: { children: ReactNode; size?: number; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {children}
    </svg>
  );
}

export const SunIcon = ({ size }: { size?: number }) => (
  <I size={size}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
  </I>
);

export const HeartIcon = ({ size }: { size?: number }) => (
  <I size={size}>
    <path d="M12 20.5S4 15.5 4 9.8C4 7 6.2 5 8.7 5c1.4 0 2.6.7 3.3 1.8C12.7 5.7 14 5 15.3 5 17.8 5 20 7 20 9.8c0 5.7-8 10.7-8 10.7Z" />
  </I>
);

export const ChartIcon = ({ size }: { size?: number }) => (
  <I size={size}>
    <path d="M4 19.5V4.5" />
    <path d="M4 19.5h16" />
    <path d="M7.5 14.5l3.4-4 3 2.4 4.4-5.4" />
  </I>
);

export const MoonIcon = ({ size }: { size?: number }) => (
  <I size={size}>
    <path d="M19.5 14.2A8 8 0 0 1 9.8 4.5a8 8 0 1 0 9.7 9.7Z" />
  </I>
);

export const BoxIcon = ({ size }: { size?: number }) => (
  <I size={size}>
    <path d="M12 3l8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z" />
    <path d="M4.2 7.4L12 11.5l7.8-4.1M12 11.5V20.7" />
  </I>
);

export const PatchIcon = ({ size }: { size?: number }) => (
  <I size={size}>
    <rect x="4.5" y="7.5" width="15" height="9" rx="4.5" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </I>
);

export const DropIcon = ({ size }: { size?: number }) => (
  <I size={size}>
    <path d="M12 3.5S6 10.2 6 14.3a6 6 0 0 0 12 0C18 10.2 12 3.5 12 3.5Z" />
  </I>
);

export const CalendarIcon = ({ size }: { size?: number }) => (
  <I size={size}>
    <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
    <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" />
  </I>
);

/** Theme cycle indicator: auto = half-filled circle, else sun/moon. */
export function ThemeGlyph({ mode }: { mode: 'system' | 'light' | 'dark' }) {
  if (mode === 'light') return <SunIcon size={18} />;
  if (mode === 'dark') return <MoonIcon size={18} />;
  return (
    <I size={18}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
    </I>
  );
}

/** The GLORY mark: a rising arc over a horizon — the "return" motif. */
export function GloryMark({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M4 16a8 8 0 0 1 16 0" stroke="var(--plum)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M2.5 19.5h19" stroke="var(--teal)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1.8" fill="var(--plum)" />
    </svg>
  );
}

export const ITEM_ICON: Record<Item, ({ size }: { size?: number }) => ReactNode> = {
  aeon: PatchIcon,
  glutathione: PatchIcon,
  carnosine: PatchIcon,
  sp6: PatchIcon,
  elix: DropIcon,
  elix_extra: DropIcon,
  d3k2: DropIcon,
};
