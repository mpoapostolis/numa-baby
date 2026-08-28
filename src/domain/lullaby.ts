// Lullabies, synthesised.
//
// Same architecture as the noise, for the same reason: rendered once into a
// WAV blob and played through an <audio loop>, because Safari suspends a live
// AudioContext the moment the screen locks — see soothe.ts.
//
// The voice is a music box, not an instrument: a fast attack and a long
// exponential decay, a touch of second harmonic, and one soft octave below to
// give it a body. Sine tones alone sound like a toy; this sounds like the
// thing above a cot.
//
// Every melody here is traditional or long out of copyright, and each is
// rendered from scratch — no recording is used, so there is nothing to
// license and nothing to download.

export type LullabyKind = "brahms" | "twinkle" | "rockabye";

export const LULLABIES: { key: LullabyKind; label: string; description: string }[] = [
  { key: "brahms", label: "Brahms", description: "Wiegenlied, 1868 — the one everyone knows" },
  { key: "twinkle", label: "Twinkle", description: "Traditional, slow and simple" },
  { key: "rockabye", label: "Rock-a-bye", description: "Traditional, gentle three-time" },
];

const SAMPLE_RATE = 22_050;
// Slow on purpose: a lullaby played at speed is a nursery rhyme.
const BEAT = 0.62;

// Semitones from A4, so a melody reads as pitch names rather than numbers.
const SEMITONE: Record<string, number> = {
  C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2,
};

/** "G4" or "C5" to hertz. */
function freq(note: string): number {
  const name = note[0];
  const octave = Number(note.slice(1));
  const semitones = SEMITONE[name] + (octave - 4) * 12;
  return 440 * Math.pow(2, semitones / 12);
}

type Note = [pitch: string | null, beats: number];

// Melodies only — a bare tune is what a music box plays, and a harmony line
// would need voicing decisions this has no way to get right.
const MELODIES: Record<LullabyKind, Note[]> = {
  // Brahms, Wiegenlied Op. 49 No. 4 (1868), opening strain.
  brahms: [
    ["G4", 1], ["G4", 1], ["B4", 2], ["G4", 1], ["G4", 1], ["B4", 2],
    ["G4", 1], ["G4", 1], ["B4", 1], ["D5", 1], ["C5", 2], ["B4", 2],
    ["A4", 1], ["A4", 1], ["B4", 1], ["C5", 1], ["D5", 2], ["D5", 2],
    ["C5", 1], ["B4", 1], ["A4", 1], ["G4", 1], ["G4", 4],
    [null, 2],
  ],
  // "Ah! vous dirai-je, maman" — traditional, taken slow.
  twinkle: [
    ["C4", 1], ["C4", 1], ["G4", 1], ["G4", 1], ["A4", 1], ["A4", 1], ["G4", 2],
    ["F4", 1], ["F4", 1], ["E4", 1], ["E4", 1], ["D4", 1], ["D4", 1], ["C4", 2],
    ["G4", 1], ["G4", 1], ["F4", 1], ["F4", 1], ["E4", 1], ["E4", 1], ["D4", 2],
    ["G4", 1], ["G4", 1], ["F4", 1], ["F4", 1], ["E4", 1], ["E4", 1], ["D4", 2],
    [null, 2],
  ],
  // "Rock-a-bye Baby" — traditional, in three.
  rockabye: [
    ["G4", 1], ["E4", 1], ["G4", 1], ["E4", 2], ["C4", 1],
    ["D4", 1], ["E4", 1], ["F4", 1], ["D4", 3],
    ["F4", 1], ["D4", 1], ["F4", 1], ["D4", 2], ["B3", 1],
    ["C4", 1], ["D4", 1], ["E4", 1], ["C4", 3],
    [null, 2],
  ],
};

/** One music-box strike, written into the buffer at `start`. */
function strike(data: Float32Array, start: number, hz: number, seconds: number) {
  const length = Math.min(Math.floor(seconds * SAMPLE_RATE), data.length - start);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    // A struck tine: no sustain, just a long decay.
    const envelope = Math.exp(-t * 3.2) * (1 - Math.exp(-t * 400));
    const tone =
      Math.sin(2 * Math.PI * hz * t) +
      0.28 * Math.sin(2 * Math.PI * hz * 2 * t) +
      0.16 * Math.sin(2 * Math.PI * hz * 0.5 * t);
    data[start + i] += envelope * tone * 0.3;
  }
}

function render(kind: LullabyKind): Float32Array {
  const melody = MELODIES[kind];
  const totalBeats = melody.reduce((sum, [, beats]) => sum + beats, 0);
  // Tail room so the last note can ring out instead of being cut at the loop.
  const length = Math.ceil((totalBeats * BEAT + 1.6) * SAMPLE_RATE);
  const data = new Float32Array(length);

  let cursor = 0;
  for (const [pitch, beats] of melody) {
    if (pitch) {
      // Notes ring past their beat, the way a music box does.
      strike(data, Math.floor(cursor * SAMPLE_RATE), freq(pitch), beats * BEAT + 1.4);
    }
    cursor += beats * BEAT;
  }

  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const gain = peak > 0 ? 0.55 / peak : 0;
  for (let i = 0; i < length; i++) data[i] *= gain;
  return data;
}

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

const cache = new Map<LullabyKind, string>();

export function lullabyUrl(kind: LullabyKind): string {
  const existing = cache.get(kind);
  if (existing) return existing;
  const url = URL.createObjectURL(toWav(render(kind)));
  cache.set(kind, url);
  return url;
}
