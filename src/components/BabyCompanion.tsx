// The baby in the app mirrors the baby in the crib. One glance at the face
// tells a tired parent the state without reading a number: sleeping (breathes,
// z's drift up), feeding (bottle at the ready), content after a feed (a small
// heart floats off), getting hungry (eyes the bottle in a thought bubble) or
// simply awake (blinks now and then). Deliberately never crying — a parent
// twenty minutes past the usual gap gets a hopeful face, not a guilt trip.
// Same illustration language as illustrations.tsx: 2px rounded strokes,
// currentColor lines, glyph-hue accents, theme-safe. All motion is slow and
// small, and the global prefers-reduced-motion block stills every keyframe.

export type CompanionMood = "awake" | "content" | "sleeping" | "hungry" | "feeding";

type BabyCompanionProps = {
  mood: CompanionMood;
  size?: number;
  className?: string;
};

function Head() {
  return (
    <>
      {/* face */}
      <circle cx="58" cy="66" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* single curl */}
      <path
        d="M58 36c0-6 4-9 9-8-4 2-5 5-4 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* ear dot */}
      <circle cx="28.5" cy="66" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* blush */}
      <circle cx="44" cy="74" r="3" fill="var(--glyph-nursing)" opacity="0.55" stroke="none" />
      <circle cx="72" cy="74" r="3" fill="var(--glyph-nursing)" opacity="0.55" stroke="none" />
    </>
  );
}

function EyesOpen() {
  return (
    <g className="companion-eyes">
      <circle cx="47" cy="63" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="69" cy="63" r="2.6" fill="currentColor" stroke="none" />
    </g>
  );
}

function EyesClosedHappy() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M43 63q4 4 8 0" />
      <path d="M65 63q4 4 8 0" />
    </g>
  );
}

function EyesAsleep() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M43 64q4 3 8 0" />
      <path d="M65 64q4 3 8 0" />
    </g>
  );
}

function SmileSmall() {
  return (
    <path d="M52 76q6 5 12 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  );
}

function MouthO() {
  return <circle cx="58" cy="78" r="3" fill="none" stroke="currentColor" strokeWidth="2" />;
}

function Bottle({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      fill="none"
      stroke="var(--glyph-bottle)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M-1 0h8v-3a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v3" transform="rotate(90 4 0)" />
      <rect x="-2" y="2" width="12" height="16" rx="4" />
      <path d="M1 7h6M1 11h6" />
    </g>
  );
}

export function BabyCompanion({ mood, size = 112, className = "" }: BabyCompanionProps) {
  return (
    <svg
      className={`baby-companion is-${mood} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 112 112"
      aria-hidden="true"
      focusable="false"
    >
      <g className="companion-body">
        <Head />

        {mood === "awake" && (
          <>
            <EyesOpen />
            <SmileSmall />
          </>
        )}

        {mood === "content" && (
          <>
            <EyesClosedHappy />
            <SmileSmall />
            {/* a little heart drifts off — the "well fed" sigh */}
            <path
              className="companion-heart"
              d="M88 40c-2-3-6-2-6 1 0 2 3 4 6 6 3-2 6-4 6-6 0-3-4-4-6-1Z"
              fill="var(--glyph-nursing)"
              stroke="none"
            />
          </>
        )}

        {mood === "sleeping" && (
          <>
            <EyesAsleep />
            <path d="M53 77h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            <g
              className="companion-zzz"
              fill="none"
              stroke="var(--glyph-sleep)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path className="z z-1" d="M86 44h7l-7 8h7" />
              <path className="z z-2" d="M97 28h5l-5 6h5" />
            </g>
          </>
        )}

        {mood === "hungry" && (
          <>
            <EyesOpen />
            <MouthO />
            {/* thought bubble: dreaming of the bottle */}
            <g className="companion-bubble">
              <circle cx="74" cy="42" r="2.5" fill="currentColor" stroke="none" opacity="0.4" />
              <circle cx="81" cy="34" r="3.5" fill="currentColor" stroke="none" opacity="0.4" />
              <circle cx="94" cy="20" r="15" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
              <Bottle x={89} y={10} scale={0.85} />
            </g>
          </>
        )}

        {mood === "feeding" && (
          <>
            <EyesClosedHappy />
            <g className="companion-feed-bottle">
              <Bottle x={84} y={62} />
            </g>
          </>
        )}
      </g>
    </svg>
  );
}
