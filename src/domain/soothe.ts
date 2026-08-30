// The soothing sounds — names, copy and file addresses.
//
// Take two of this feature. The first synthesised audio in the browser at
// tap time and died of it: the synthesis pushed play() outside the
// user-gesture window on mid-range phones and blob URLs misbehaved in
// standalone WebKit — a countdown over silence, reported by the exact
// parents it was built for. The sounds are now REAL FILES, rendered at
// build time by scripts/make-sounds.mjs: the tap spends its whole gesture
// on play(), and iOS treats a media file as media — it keeps playing with
// the screen locked. Noise is WAV (PCM has no encoder padding, so the loop
// seam is inaudible); lullabies are AAC, where a breath at the loop point
// suits the tune anyway.

export type NoiseKind = "white" | "pink" | "brown";
export type LullabyKind = "brahms" | "twinkle" | "rockabye";
export type SoundKind = NoiseKind | LullabyKind;

export const NOISE_KINDS: { key: NoiseKind; label: string; description: string }[] = [
  { key: "brown", label: "Rumble", description: "Deepest and softest — closest to the womb" },
  { key: "pink", label: "Rain", description: "Balanced, like steady rainfall" },
  { key: "white", label: "Hush", description: "Brightest — the classic shhh" },
];

export const LULLABIES: { key: LullabyKind; label: string; description: string }[] = [
  { key: "brahms", label: "Brahms", description: "Wiegenlied, 1868 — the one everyone knows" },
  { key: "twinkle", label: "Twinkle", description: "Traditional, slow and simple" },
  { key: "rockabye", label: "Rock-a-bye", description: "Traditional, gentle three-time" },
];

const LULLABY_KEYS: readonly string[] = LULLABIES.map((l) => l.key);

export function soundUrl(kind: SoundKind): string {
  return `/sounds/${kind}.${LULLABY_KEYS.includes(kind) ? "m4a" : "wav"}`;
}

export const TIMER_CHOICES = [15, 30, 45, 60] as const;
export type TimerChoice = (typeof TIMER_CHOICES)[number] | null;
