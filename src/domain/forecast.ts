// "What is probably next."
//
// Three forecasts — the next feed, the next sleep, the next nappy — from one
// piece of arithmetic: look at the gaps between the things that already
// happened, take the middle one, and add it to the last. No model, no
// training, nothing sent anywhere. It learns one baby: yours.
//
// The median rather than the mean, because a single four-hour night should not
// drag the daytime estimate two hours later. The spread is the median distance
// from that middle gap, which is what turns "17:20" into "17:00–17:40" — an
// honest width instead of a false decimal point.
//
// And the rule that matters most: WHEN THE NUMBERS DO NOT AGREE WITH EACH
// OTHER, SAY NOTHING. A forecast built from gaps that scatter by hours is
// noise wearing a clock face, and a parent following it at 3am deserves
// better than a confident-looking guess. That is `noisyAbove`.

import { median } from "./time";

export type ForecastKind = "feed" | "sleep" | "diaper";

export type Forecast = {
  kind: ForecastKind;
  /** When it is likely — or null while there is not enough of a rhythm yet. */
  at: number | null;
  /** Half-width of the likely window, in minutes. */
  spread: number;
  /** The typical gap, in minutes. Zero when unknown. */
  typicalGap: number;
  /** How many gaps the estimate rests on. */
  samples: number;
  /** True once the whole window has gone by — a forecast, not a memory. */
  passed: boolean;
};

export type ForecastBounds = {
  /** Gaps outside this range are not a rhythm: a double-tap, or a gap with a
      night in the middle of it. */
  minGap: number;
  maxGap: number;
  /** Fewer gaps than this and there is nothing to average. */
  minSamples: number;
  /** The window is never narrower or wider than this, whatever the data says
      — a five-minute window is a promise nobody can keep. */
  minSpread: number;
  maxSpread: number;
  /** If the gaps disagree with each other by more than this many minutes on
      average, there is no rhythm to report. Undefined means always report. */
  noisyAbove?: number;
};

/** Feeding is the steadiest of the three and the one people already trust; the
    numbers here are unchanged from when it was the only forecast. */
export const FEED_BOUNDS: ForecastBounds = {
  minGap: 21,
  maxGap: 479,
  minSamples: 3,
  minSpread: 15,
  maxSpread: 45,
};

export const SLEEP_BOUNDS: ForecastBounds = {
  minGap: 20,
  maxGap: 360,
  minSamples: 2,
  minSpread: 15,
  maxSpread: 40,
};

/** Nappies are the noisiest of the three by a distance — a baby fills one when
    they fill one, and no amount of median will change that. So this asks for
    more evidence before it says anything, and stays quiet when the evidence
    disagrees with itself. Better a blank row than a wrong time. */
export const DIAPER_BOUNDS: ForecastBounds = {
  minGap: 25,
  maxGap: 420,
  minSamples: 5,
  minSpread: 20,
  maxSpread: 60,
  noisyAbove: 75,
};

/** Minutes between consecutive moments, in any order in, chronological out.
    Sleep does not use this — the gap that matters there runs from the END of
    one sleep to the START of the next, which is two lists, not one. */
export function gapsBetween(moments: number[]): number[] {
  const ordered = [...moments].sort((a, b) => a - b);
  return ordered.slice(1).map((moment, index) => Math.round((moment - ordered[index]) / 60_000));
}

/**
 * Turn a series of gaps into a guess about the next one.
 *
 * @param rawGaps  every gap in minutes, unfiltered — the bounds decide which
 *                 of them count as a rhythm
 * @param measureFrom  what the next one is counted from: the last feed's
 *                     start, the last sleep's END, the last nappy
 * @param now  the minute clock, so every figure on screen rolls over together
 */
export function forecast(
  kind: ForecastKind,
  rawGaps: number[],
  measureFrom: number | null,
  now: number,
  bounds: ForecastBounds,
): Forecast {
  const gaps = rawGaps.filter((minutes) => minutes >= bounds.minGap && minutes <= bounds.maxGap);

  const typicalGap = median(gaps);
  const deviation = gaps.length ? median(gaps.map((gap) => Math.abs(gap - typicalGap))) : 0;
  const spread = gaps.length
    ? Math.max(bounds.minSpread, Math.min(bounds.maxSpread, deviation))
    : bounds.minSpread + 5;

  const scattered = bounds.noisyAbove !== undefined && deviation > bounds.noisyAbove;
  const ready = gaps.length >= bounds.minSamples && measureFrom !== null && !scattered;
  const at = ready ? measureFrom + typicalGap * 60_000 : null;

  return {
    kind,
    at,
    spread,
    typicalGap,
    samples: gaps.length,
    // A card reading "14:05–14:45" at 17:00 presents history as a forecast.
    passed: at !== null && at + spread * 60_000 < now,
  };
}

/** The same forecast, re-judged against a later clock. The window is worked
    out once from the data; whether it has gone by changes every minute. */
export function atClock(value: Forecast, now: number): Forecast {
  return {
    ...value,
    passed: value.at !== null && value.at + value.spread * 60_000 < now,
  };
}
