import type { SVGProps } from "react";

// Original empty-state illustrations. Hand-drawn geometry, 2px rounded
// strokes on currentColor so they inherit the muted ink of their empty
// state, with one accent from the token palette so they read in both
// themes. Decorative by default: role="img" + aria-hidden.

type IllustrationProps = SVGProps<SVGSVGElement> & { size?: number };

function frame(size: number, props: Omit<IllustrationProps, "size">) {
  return {
    viewBox: "0 0 96 96",
    width: size,
    height: size,
    role: "img",
    "aria-hidden": true,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props,
  } as const;
}

// Crescent moon dozing, two sparkle stars keeping watch.
export function SleepyMoon({ size = 104, ...props }: IllustrationProps) {
  return (
    <svg {...frame(size, props)}>
      <path d="M56 22A30 30 0 1 0 56 74A28 28 0 0 1 56 22Z" />
      <path d="M19 46q3 3 6 0" />
      <path d="M31 46q3 3 6 0" />
      <path d="M25 55q3 2.5 6 0" />
      <path
        d="M74 26l2.2 5.8 5.8 2.2-5.8 2.2-2.2 5.8-2.2-5.8-5.8-2.2 5.8-2.2z"
        fill="var(--signal)"
        stroke="none"
      />
      <path
        d="M68 58l1.6 4.2 4.2 1.6-4.2 1.6-1.6 4.2-1.6-4.2-4.2-1.6 4.2-1.6z"
        fill="var(--glyph-sleep)"
        stroke="none"
      />
    </svg>
  );
}

// Baby bottle sending up a little heart.
export function LittleBottle({ size = 104, ...props }: IllustrationProps) {
  return (
    <svg {...frame(size, props)}>
      <path d="M34 22c0-6 4-10 8-10s8 4 8 10" />
      <rect x="30" y="22" width="24" height="8" rx="3" />
      <rect x="27" y="30" width="30" height="46" rx="9" />
      <path d="M33 44h8M33 54h8M33 64h8" stroke="var(--signal)" />
      <circle cx="62" cy="42" r="1.8" fill="var(--glyph-nursing)" stroke="none" />
      <path
        d="M72 36c-4.4-3.2-8.6-6-8.6-10 0-2.8 2.1-4.6 4.5-4.6 1.7 0 3.2 1 4.1 2.5.9-1.5 2.4-2.5 4.1-2.5 2.4 0 4.5 1.8 4.5 4.6 0 4-4.2 6.8-8.6 10z"
        fill="var(--glyph-nursing)"
        stroke="none"
      />
    </svg>
  );
}

// A sprout on a baseline, with two data points on their way up.
export function SproutChart({ size = 104, ...props }: IllustrationProps) {
  return (
    <svg {...frame(size, props)}>
      <path d="M14 78h68" />
      <path d="M40 78V46" />
      <path d="M40 62c0-9-7-16-17-16 0 9 7 16 17 16z" stroke="var(--glyph-growth)" />
      <path d="M40 52c0-9 7-16 17-16 0 9-7 16-17 16z" stroke="var(--glyph-growth)" />
      <circle cx="62" cy="64" r="2.5" fill="var(--signal)" stroke="none" />
      <circle cx="72" cy="54" r="2.5" fill="var(--signal)" stroke="none" />
    </svg>
  );
}
