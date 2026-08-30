// Renders every soothing sound into real files under public/sounds/.
//
// The first version of this feature synthesised audio in the browser at tap
// time — and died of it: the synthesis pushed play() outside the user-gesture
// window on mid-range phones, blob URLs misbehaved in standalone WebKit, and
// the result was a countdown over silence. Files have none of those failure
// modes: the tap spends its gesture on play() alone, and iOS treats a real
// media file as media — it keeps playing with the screen locked.
//
// Noise ships as 8-second WAV loops (PCM has no encoder padding, so the loop
// seam stays inaudible; 8s mono 22kHz is ~350KB). Lullabies ship as AAC
// (.m4a via ffmpeg) — a tune tolerates the tiny encoder gap at the loop
// point, and 60-90 seconds of WAV would not tolerate the size.
//
// Everything here is synthesised from scratch — traditional melodies, no
// recordings, nothing to license. Run: node scripts/make-sounds.mjs

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SAMPLE_RATE = 22_050;
const OUT = "public/sounds";

// ---- WAV container ---------------------------------------------------------

function toWav(samples) {
  const bytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + bytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + bytes, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(bytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 0x7fff), 44 + i * 2);
  }
  return buffer;
}

function normalise(data, peakTarget) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  const gain = peak > 0 ? peakTarget / peak : 0;
  for (let i = 0; i < data.length; i++) data[i] *= gain;
}

// ---- Noise (see the old src/domain/soothe.ts this was ported from) ---------

const NOISE_SECONDS = 8;
const FADE = 512;

function generateNoise(kind) {
  const length = SAMPLE_RATE * NOISE_SECONDS;
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
  normalise(data, 0.6);
  // Crossfade the tail into the head so the loop point is inaudible.
  for (let i = 0; i < FADE; i++) {
    const t = i / FADE;
    data[i] = data[i] * t + data[length - FADE + i] * (1 - t);
  }
  return data;
}

// ---- Lullabies (ported from the old src/domain/lullaby.ts) -----------------

const BEAT = 0.62;
const SEMITONE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

function freq(note) {
  return 440 * Math.pow(2, (SEMITONE[note[0]] + (Number(note.slice(1)) - 4) * 12) / 12);
}

const MELODIES = {
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

/** One music-box strike: fast attack, long decay, a touch of body. */
function strike(data, start, hz, seconds) {
  const length = Math.min(Math.floor(seconds * SAMPLE_RATE), data.length - start);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 3.2) * (1 - Math.exp(-t * 400));
    const tone =
      Math.sin(2 * Math.PI * hz * t) +
      0.28 * Math.sin(2 * Math.PI * hz * 2 * t) +
      0.16 * Math.sin(2 * Math.PI * hz * 0.5 * t);
    data[start + i] += envelope * tone * 0.3;
  }
}

function renderLullaby(kind) {
  const melody = MELODIES[kind];
  const totalBeats = melody.reduce((sum, [, beats]) => sum + beats, 0);
  const length = Math.ceil((totalBeats * BEAT + 1.6) * SAMPLE_RATE);
  const data = new Float32Array(length);
  let cursor = 0;
  for (const [pitch, beats] of melody) {
    if (pitch) strike(data, Math.floor(cursor * SAMPLE_RATE), freq(pitch), beats * BEAT + 1.4);
    cursor += beats * BEAT;
  }
  normalise(data, 0.55);
  return data;
}

// ---- Write everything ------------------------------------------------------

mkdirSync(OUT, { recursive: true });

for (const kind of ["white", "pink", "brown"]) {
  const path = join(OUT, `${kind}.wav`);
  writeFileSync(path, toWav(generateNoise(kind)));
  console.log("wrote", path);
}

for (const kind of Object.keys(MELODIES)) {
  const wavPath = join(OUT, `${kind}.tmp.wav`);
  const m4aPath = join(OUT, `${kind}.m4a`);
  writeFileSync(wavPath, toWav(renderLullaby(kind)));
  execFileSync("ffmpeg", ["-y", "-i", wavPath, "-c:a", "aac", "-b:a", "64k", m4aPath], { stdio: "pipe" });
  rmSync(wavPath);
  console.log("wrote", m4aPath);
}
