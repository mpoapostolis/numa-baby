import { expect, test } from "vitest";
// @ts-expect-error — a build script's helper, plain JS with no types.
import { seamlessLoop } from "../../scripts/loopSeam.mjs";

// The noise used to jump at its loop point: the tail was blended into the
// head but never cut off, so every pass replayed 23ms and stepped from the
// file's last sample back to an earlier one. On Rumble (brown noise, the
// default) that step was seven times the normal one — a click every eight
// seconds, reported as "a split-second pause".

// A deterministic stand-in for Math.random, so the test cannot flake.
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function brown(length: number) {
  const random = lcg(7);
  const data = new Float32Array(length);
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = (last + (random() * 2 - 1) * 0.02) * 0.998;
    data[i] = last;
  }
  return data;
}

function white(length: number) {
  const random = lcg(11);
  return Float32Array.from({ length }, () => random() * 2 - 1);
}

function meanStep(data: Float32Array) {
  let sum = 0;
  for (let i = 1; i < data.length; i++) sum += Math.abs(data[i] - data[i - 1]);
  return sum / (data.length - 1);
}

function rms(data: Float32Array, from: number, to: number) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += data[i] ** 2;
  return Math.sqrt(sum / (to - from));
}

test("the loop is the source minus the stretch blended into its start", () => {
  const out = seamlessLoop(brown(20_000), 512);
  expect(out.length).toBe(20_000 - 512);
});

test("playing past the end into the start does not jump", () => {
  const out = seamlessLoop(brown(200_000), 512);
  const seam = Math.abs(out[0] - out[out.length - 1]);
  expect(seam).toBeLessThan(meanStep(out) * 3);
});

test("the blend does not dip in loudness", () => {
  // A plain linear blend of two unrelated noises sags about 3dB in the
  // middle: a soft hole, once per pass.
  const source = white(200_000);
  const out = seamlessLoop(source, 2048);
  const blended = rms(out, 768, 1280);
  const elsewhere = rms(out, 50_000, 150_000);
  expect(blended / elsewhere).toBeGreaterThan(0.9);
});
