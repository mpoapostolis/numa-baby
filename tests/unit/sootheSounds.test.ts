import { expect, test } from "vitest";
import { LULLABIES, NOISE_KINDS, soundUrl } from "@/domain/soothe";

// A parent heard "a split-second pause" every eight or nine seconds. The
// noise was an 8-second WAV, and a phone's audio element leaves a gap each
// time it starts a file over — 450 of them an hour. The noise is now a
// ten-minute AAC loop, the format the lullabies already used.
test("every sound is an AAC file", () => {
  for (const { key } of [...NOISE_KINDS, ...LULLABIES]) {
    expect(soundUrl(key)).toBe(`/sounds/${key}.m4a`);
  }
});
