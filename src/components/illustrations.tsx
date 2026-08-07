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

// The baby herself: a round face fast asleep — one curl on top, closed
// arc eyes, the smallest smile, blush dots in the nursing rose. Sized for
// chips (22-26px renders), so unlike the large-format illustrations the
// stroke is 6/96 — about 1.4px on screen, matching the lucide glyph weight
// beside it — and the blush dots are big enough to survive the downscale.
export function BabyFace({ size = 24, ...props }: IllustrationProps) {
  return (
    <svg {...frame(size, { strokeWidth: 6, ...props })}>
      <circle cx="48" cy="54" r="26" />
      <path d="M48 28c0-6 4-10 9-9-4 1-5 4-4 7" />
      <path d="M36 52q4 4 8 0" />
      <path d="M52 52q4 4 8 0" />
      <path d="M44 64q4 3.5 8 0" />
      <circle cx="32" cy="60" r="4.5" fill="var(--glyph-nursing)" stroke="none" />
      <circle cx="64" cy="60" r="4.5" fill="var(--glyph-nursing)" stroke="none" />
    </svg>
  );
}

// Two four-point stars in the signal amber. A garnish, never a headline.
export function TinyStars({ size = 20, ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-hidden
      fill="var(--signal)"
      stroke="none"
      {...props}
    >
      <path d="M17 6l2.4 6.2 6.2 2.4-6.2 2.4-2.4 6.2-2.4-6.2-6.2-2.4 6.2-2.4z" />
      <path d="M33 26l1.7 4.3 4.3 1.7-4.3 1.7-1.7 4.3-1.7-4.3-4.3-1.7 4.3-1.7z" />
    </svg>
  );
}

// The splash mark: the BabyFace fast asleep under one amber star. Static on
// purpose — a still sleeping face on a two-second splash is calmer than any
// animation. Rendered at 64px, so the stroke is 3/96 — about 2px on screen,
// the same pen weight as the rest of the illustration language.
export function SleepingBaby({ size = 64, style, ...props }: IllustrationProps) {
  return (
    <svg
      {...frame(size, {
        strokeWidth: 3,
        style: {
          color: "color-mix(in oklch, var(--glyph-nursing) 45%, var(--foreground))",
          ...style,
        },
        ...props,
      })}
    >
      <circle cx="48" cy="54" r="26" />
      <path d="M48 28c0-6 4-10 9-9-4 1-5 4-4 7" />
      <path d="M35 52.5q3.5 2.5 7 0" />
      <path d="M54 52.5q3.5 2.5 7 0" />
      <path d="M44 64q4 3.5 8 0" />
      <circle cx="32" cy="60" r="4" fill="var(--glyph-nursing)" opacity="0.55" stroke="none" />
      <circle cx="64" cy="60" r="4" fill="var(--glyph-nursing)" opacity="0.55" stroke="none" />
      <path
        d="M76 16l2.2 5.8 5.8 2.2-5.8 2.2-2.2 5.8-2.2-5.8-5.8-2.2 5.8-2.2z"
        fill="var(--signal)"
        stroke="none"
      />
    </svg>
  );
}

// Nursery at night — the onboarding hero. The companion's own sleeping face
// (same circle, curl, blush and asleep-arc eyes as BabyCompanion, at 80%)
// rests on one blanket arc that doubles as the ground line; the SleepyMoon
// crescent keeps watch at half size, a ghosted LittleBottle waits on the
// blanket, and two z's drift on the lullaby loop defined in onboarding.css.
export function NurseryScene({ style, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 140"
      width={180}
      height={126}
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        color: "color-mix(in oklch, var(--glyph-nursing) 45%, var(--foreground))",
        ...style,
      }}
      {...props}
    >
      {/* the blanket doubles as the ground line */}
      <path d="M10 118Q100 106 190 118" />
      {/* baby head resting on the blanket — companion geometry at 80% */}
      <circle cx="62" cy="89" r="24" />
      <path d="M62 65c0-5 3-7.5 7-6.5-3 1.5-4 4-3 6.5" />
      <circle cx="38.5" cy="89" r="2.8" />
      <path d="M50 87.5q3.5 2.5 7 0" />
      <path d="M67 87.5q3.5 2.5 7 0" />
      <path d="M58 98h8" />
      <circle cx="50.5" cy="95.5" r="2.4" fill="var(--glyph-nursing)" opacity="0.55" stroke="none" />
      <circle cx="73.5" cy="95.5" r="2.4" fill="var(--glyph-nursing)" opacity="0.55" stroke="none" />
      {/* two z's — looped by onboarding.css, never by companion.css */}
      <g stroke="var(--glyph-sleep)">
        <path className="z z-1" d="M84 52h7l-7 8h7" />
        <path className="z z-2" d="M96 38h5l-5 6h5" />
      </g>
      {/* SleepyMoon crescent at half size, upper-right (4/2 stroke compensates the scale) */}
      <g transform="translate(132 9) scale(0.5)" strokeWidth={4}>
        <path d="M56 22A30 30 0 1 0 56 74A28 28 0 0 1 56 22Z" />
      </g>
      {/* exactly two stars: one signal, one sleep */}
      <path
        d="M126 12l2.2 5.8 5.8 2.2-5.8 2.2-2.2 5.8-2.2-5.8-5.8-2.2 5.8-2.2z"
        fill="var(--signal)"
        stroke="none"
      />
      <path
        d="M184 50l1.6 4.2 4.2 1.6-4.2 1.6-1.6 4.2-1.6-4.2-4.2-1.6 4.2-1.6z"
        fill="var(--glyph-sleep)"
        stroke="none"
      />
      {/* the bottle waits on the blanket line, ghosted */}
      <g transform="translate(102 71) scale(0.55)" strokeWidth={3.6} opacity="0.4">
        <path d="M34 22c0-6 4-10 8-10s8 4 8 10" />
        <rect x="30" y="22" width="24" height="8" rx="3" />
        <rect x="27" y="30" width="30" height="46" rx="9" />
        <path d="M33 44h8M33 54h8M33 64h8" stroke="var(--signal)" />
      </g>
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
