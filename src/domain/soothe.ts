// The white-noise player.
//
// THE iOS PROBLEM, and why this is built the way it is. Web Audio is the
// obvious tool — an oscillator and a filter, a dozen lines — but Safari
// suspends an AudioContext the moment the screen locks or the app goes to
// the background, which is precisely when a parent needs the sound to keep
// going. A soother that dies mid-nap is worse than no soother at all.
//
// A media element is treated as media: iOS keeps it playing with the screen
// off and puts it on the lock screen. So the noise is GENERATED once into a
// WAV blob and handed to an <audio loop>. Nothing is downloaded, nothing is
// bundled, and the audio survives the lock screen.

export type NoiseKind = "white" | "pink" | "brown";

export const NOISE_KINDS: { key: NoiseKind; label: string; description: string }[] = [
  { key: "brown", label: "Rumble", description: "Deepest and softest — closest to the womb" },
  { key: "pink", label: "Rain", description: "Balanced, like steady rainfall" },
  { key: "white", label: "Hush", description: "Brightest — the classic shhh" },
];

const SAMPLE_RATE = 22_050;
const SECONDS = 8;
// The loop seam is smoothed over this many samples so it never clicks.
const FADE = 512;

/** Fill a buffer with the chosen noise, normalised to a comfortable peak. */
function generate(kind: NoiseKind): Float32Array {
  const length = SAMPLE_RATE * SECONDS;
  const data = new Float32Array(length);

  if (kind === "white") {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  } else if (kind === "pink") {
    // Voss-McCartney: cheap, and closer to natural rainfall than a filter.
    const rows = 8;
    const state = new Float32Array(rows);
    let running = 0;
    for (let i = 0; i < length; i++) {
      let n = i;
      for (let row = 0; row < rows; row++) {
        if ((n & 1) === 0) {
          running -= state[row];
          state[row] = Math.random() * 2 - 1;
          running += state[row];
          break;
        }
        n >>= 1;
      }
      data[i] = (running + (Math.random() * 2 - 1)) / (rows + 1);
    }
  } else {
    // Brown: an integrated random walk, leaked so it cannot drift away.
    let last = 0;
    for (let i = 0; i < length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.02) * 0.998;
      data[i] = last;
    }
  }

  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const gain = peak > 0 ? 0.6 / peak : 0;
  for (let i = 0; i < length; i++) data[i] *= gain;

  // Crossfade the tail into the head so the loop point is inaudible.
  for (let i = 0; i < FADE; i++) {
    const t = i / FADE;
    data[i] = data[i] * t + data[length - FADE + i] * (1 - t);
  }
  return data;
}

/** 16-bit mono PCM in a WAV container — the smallest thing every browser plays. */
function toWav(samples: Float32Array): Blob {
  const bytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, bytes, true);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

const cache = new Map<NoiseKind, string>();

/** A looping object URL for this noise. Generated once per kind, then reused. */
export function noiseUrl(kind: NoiseKind): string {
  const existing = cache.get(kind);
  if (existing) return existing;
  const url = URL.createObjectURL(toWav(generate(kind)));
  cache.set(kind, url);
  return url;
}

export const TIMER_CHOICES = [15, 30, 45, 60] as const;
export type TimerChoice = (typeof TIMER_CHOICES)[number] | null;
