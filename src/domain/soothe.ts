// The soothing sounds — names, copy and file addresses.
//
// Take two of this feature. The first synthesised audio in the browser at
// tap time and died of it: the synthesis pushed play() outside the
// user-gesture window on mid-range phones and blob URLs misbehaved in
// standalone WebKit — a countdown over silence, reported by the exact
// parents it was built for. The sounds are now REAL FILES, rendered at
// build time by scripts/make-sounds.mjs: the tap spends its whole gesture
// on play(), and iOS treats a media file as media — it keeps playing with
// the screen locked.
//
// Take three, for the noise. It was an 8-second WAV on the theory that PCM
// loops without a seam — but the seam that matters is the player's: an
// <audio> element restarting a file leaves a split-second gap, and a parent
// heard it every eight seconds. Gapless looping needs Web Audio, which iOS
// suspends when the screen locks, so the gap stays and the loop got long:
// ten minutes of AAC, six restarts an hour instead of 450. Lullabies were
// AAC already, where a breath at the loop point suits the tune anyway.

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

export function soundUrl(kind: SoundKind): string {
  return `/sounds/${kind}.m4a`;
}

export const TIMER_CHOICES = [15, 30, 45, 60] as const;
export type TimerChoice = (typeof TIMER_CHOICES)[number] | null;

// What was last played, remembered on this phone. "Keep going" used to be a
// choice made again every night — the player opened at 30 minutes each time,
// and the noise stopped under a parent who had wanted it all night. The
// volume is deliberately NOT here: it always opens low.
export type SootheChoice = {
  mode: "noise" | "lullaby";
  kind: NoiseKind;
  tune: LullabyKind;
  timer: TimerChoice;
};

export const DEFAULT_SOOTHE_CHOICE: SootheChoice = { mode: "noise", kind: "brown", tune: "brahms", timer: 30 };

const CHOICE_KEY = "numalog-soothe-v1";

export function loadSootheChoice(): SootheChoice {
  try {
    const raw = window.localStorage.getItem(CHOICE_KEY);
    if (!raw) return DEFAULT_SOOTHE_CHOICE;
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const d = DEFAULT_SOOTHE_CHOICE;
    return {
      mode: stored.mode === "noise" || stored.mode === "lullaby" ? stored.mode : d.mode,
      kind: NOISE_KINDS.find((n) => n.key === stored.kind)?.key ?? d.kind,
      tune: LULLABIES.find((l) => l.key === stored.tune)?.key ?? d.tune,
      timer: stored.timer === null ? null : TIMER_CHOICES.find((t) => t === stored.timer) ?? d.timer,
    };
  } catch {
    return DEFAULT_SOOTHE_CHOICE;
  }
}

export function saveSootheChoice(choice: SootheChoice) {
  try {
    window.localStorage.setItem(CHOICE_KEY, JSON.stringify(choice));
  } catch {
    // A remembered choice is a courtesy.
  }
}
