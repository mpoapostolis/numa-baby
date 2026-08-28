// The forecasts are the only place this app tells a parent what is about to
// happen, so the tests are mostly about the times it must REFUSE to say.

import { describe, expect, it } from "vitest";
import {
  DIAPER_BOUNDS,
  FEED_BOUNDS,
  SLEEP_BOUNDS,
  atClock,
  forecast,
  gapsBetween,
} from "@/domain/forecast";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-08-28T18:00:00.000Z");

/** `count` moments, `gapMinutes` apart, ending `endsAgoMinutes` before NOW. */
function series(count: number, gapMinutes: number, endsAgoMinutes = 0): number[] {
  const last = NOW - endsAgoMinutes * 60_000;
  return Array.from({ length: count }, (_, index) => last - (count - 1 - index) * gapMinutes * 60_000);
}

describe("forecast", () => {
  it("adds the typical gap to the last occurrence", () => {
    const moments = series(6, 180, 60);
    const result = forecast("feed", gapsBetween(moments), moments[moments.length - 1], NOW, FEED_BOUNDS);
    expect(result.typicalGap).toBe(180);
    expect(result.at).toBe(NOW + 2 * HOUR);
    expect(result.passed).toBe(false);
  });

  it("takes the middle gap, not the average — one long night must not move the day", () => {
    // Five three-hour gaps and one nine-hour night. The mean would say four
    // hours; the middle says three, which is what tomorrow morning looks like.
    const base = NOW - 30 * HOUR;
    const moments = [0, 3, 6, 9, 18, 21, 24].map((hours) => base + hours * HOUR);
    const result = forecast("feed", gapsBetween(moments), moments[moments.length - 1], NOW, FEED_BOUNDS);
    expect(result.typicalGap).toBe(180);
  });

  it("ignores a double tap and a gap with a whole night inside it", () => {
    const base = NOW - 20 * HOUR;
    const moments = [
      base,
      base + 60_000, // logged twice by accident
      base + 3 * HOUR,
      base + 6 * HOUR,
      base + 9 * HOUR,
      base + 19 * HOUR, // ten hours later — not a rhythm
    ];
    const result = forecast("feed", gapsBetween(moments), moments[moments.length - 1], NOW, FEED_BOUNDS);
    expect(result.samples).toBe(3);
    expect(result.typicalGap).toBe(180);
  });

  it("says nothing until there is something to average", () => {
    const moments = series(2, 180);
    const result = forecast("feed", gapsBetween(moments), moments[moments.length - 1], NOW, FEED_BOUNDS);
    expect(result.at).toBeNull();
    expect(result.samples).toBe(1);
  });

  it("says nothing when there is no last occurrence to count from", () => {
    expect(forecast("sleep", gapsBetween(series(6, 120)), null, NOW, SLEEP_BOUNDS).at).toBeNull();
  });

  it("marks a window that has entirely gone by", () => {
    const moments = series(6, 180, 300); // last one five hours ago
    const result = forecast("feed", gapsBetween(moments), moments[moments.length - 1], NOW, FEED_BOUNDS);
    expect(result.at).toBeLessThan(NOW);
    expect(result.passed).toBe(true);
  });

  it("keeps the window honest — never a false decimal point, never a useless width", () => {
    const metronome = forecast("feed", gapsBetween(series(8, 180)), NOW, NOW, FEED_BOUNDS);
    expect(metronome.spread).toBe(FEED_BOUNDS.minSpread);

    const base = NOW - 24 * HOUR;
    const scattered = [0, 1, 4, 5, 8.5, 9.5, 13].map((hours) => base + hours * HOUR);
    expect(forecast("feed", gapsBetween(scattered), NOW, NOW, FEED_BOUNDS).spread).toBeLessThanOrEqual(
      FEED_BOUNDS.maxSpread,
    );
  });
});

describe("nappies, which are the noisy one", () => {
  it("forecasts when the changes really do fall into a rhythm", () => {
    const moments = series(8, 150, 30);
    const result = forecast("diaper", gapsBetween(moments), moments[moments.length - 1], NOW, DIAPER_BOUNDS);
    expect(result.at).toBe(NOW + 2 * HOUR);
  });

  it("refuses when the gaps disagree with each other", () => {
    // 40 minutes, then four hours, then 45, then three and a half… a real
    // pattern for a real baby, and nothing anyone should put a clock time on.
    const base = NOW - 20 * HOUR;
    const hours = [0, 0.7, 4.7, 5.4, 9, 9.6, 13.5, 14.2, 18];
    const moments = hours.map((h) => base + h * HOUR);
    const result = forecast("diaper", gapsBetween(moments), moments[moments.length - 1], NOW, DIAPER_BOUNDS);
    expect(result.samples).toBeGreaterThanOrEqual(DIAPER_BOUNDS.minSamples);
    expect(result.at).toBeNull();
  });

  it("asks for more evidence than a feed does before saying anything", () => {
    const moments = series(4, 150);
    const last = moments[moments.length - 1];
    expect(forecast("feed", gapsBetween(moments), last, NOW, FEED_BOUNDS).at).not.toBeNull();
    expect(forecast("diaper", gapsBetween(moments), last, NOW, DIAPER_BOUNDS).at).toBeNull();
  });
});

describe("atClock", () => {
  it("re-judges the same window against a later minute without redoing the maths", () => {
    const moments = series(6, 180, 60);
    const fresh = forecast("feed", gapsBetween(moments), moments[moments.length - 1], NOW, FEED_BOUNDS);
    expect(fresh.passed).toBe(false);

    const later = atClock(fresh, fresh.at! + fresh.spread * 60_000 + 60_000);
    expect(later.passed).toBe(true);
    expect(later.at).toBe(fresh.at);
    expect(later.typicalGap).toBe(fresh.typicalGap);
  });

  it("never calls a window passed when there is no window", () => {
    const nothing = forecast("diaper", [], null, NOW, DIAPER_BOUNDS);
    expect(atClock(nothing, NOW + 10 * HOUR).passed).toBe(false);
  });
});
