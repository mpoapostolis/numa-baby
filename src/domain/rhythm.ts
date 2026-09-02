// The track record of "what is probably next".
//
// A forecast nobody can check is a horoscope. This scores the app's own
// guesses against what actually happened, using only what is already in the
// log: for each event in turn, work out the window the app WOULD have shown
// from everything before it, then look at when the thing really happened.
// Nothing is stored, nothing is sent — the score is recomputed from the log
// every time, which also means it can never drift out of step with the data.
//
// The point is not the number. The point is that a parent can see the app
// was right yesterday, which is the difference between a guess and a thing
// worth telling a friend about.

import { Forecast, ForecastBounds, ForecastKind, forecast } from "./forecast";

/** One interval that already happened: `from` is what the app would have
    counted from, `to` is when the next one actually came. */
export type RhythmStep = { from: number; to: number };

export type RhythmCall = {
  /** The middle of the window the app would have shown. */
  predicted: number;
  /** When it really happened. */
  actual: number;
  /** Minutes out — negative means it came early. */
  offBy: number;
  hit: boolean;
};

export type RhythmRecord = {
  kind: ForecastKind;
  /** Predictions that could be scored at all. */
  checked: number;
  hits: number;
  /** Typical distance from the middle of the window, in minutes. */
  typicalMiss: number;
  /** Newest first, for "we said 17:20, she went at 17:35". */
  recent: RhythmCall[];
};

/** How many scored calls before the record is worth showing at all. */
export const MIN_SCORED_CALLS = 4;

/** How far back the score looks. Recent behaviour, not a lifetime average. */
export const SCORED_WINDOW = 12;

/**
 * Score the app's own guesses. `steps` must be chronological; each entry is
 * one completed interval (feed to feed, or the end of one sleep to the start
 * of the next), which is exactly what the forecast measures.
 */
export function rhythmRecord(kind: ForecastKind, steps: RhythmStep[], bounds: ForecastBounds, keep = 5): RhythmRecord {
  const gaps = steps.map((step) => Math.round((step.to - step.from) / 60_000));
  const calls: RhythmCall[] = [];
  // Only the recent stretch is scored. A run of forty is not a better claim
  // than a run of twelve — it is a claim about a baby who has since changed,
  // and "right 38 of the last 41" reads as arithmetic rather than as help.
  const from = Math.max(bounds.minSamples, steps.length - SCORED_WINDOW);
  for (let index = from; index < steps.length; index += 1) {
    // Exactly the call the app would have made standing at steps[index].from.
    const guess: Forecast = forecast(kind, gaps.slice(0, index), steps[index].from, steps[index].from, bounds);
    if (guess.at === null) continue;
    const offBy = Math.round((steps[index].to - guess.at) / 60_000);
    calls.push({
      predicted: guess.at,
      actual: steps[index].to,
      offBy,
      hit: Math.abs(offBy) <= guess.spread,
    });
  }
  const misses = calls.map((call) => Math.abs(call.offBy)).sort((a, b) => a - b);
  return {
    kind,
    checked: calls.length,
    hits: calls.filter((call) => call.hit).length,
    typicalMiss: misses.length ? misses[Math.floor(misses.length / 2)] : 0,
    recent: calls.slice(-keep).reverse(),
  };
}

/** Feed starts, newest-first as the stats hook holds them, into steps. */
export function stepsFromMoments(moments: number[]): RhythmStep[] {
  const ordered = [...moments].sort((a, b) => a - b);
  return ordered.slice(1).map((moment, index) => ({ from: ordered[index], to: moment }));
}

/** The sentence the card says. Null while there is not enough to say. */
export function rhythmLine(record: RhythmRecord, name: string): string | null {
  if (record.checked < MIN_SCORED_CALLS) return null;
  const who = name.trim() || "your baby";
  if (record.hits === record.checked) {
    return `Right every one of the last ${record.checked} times.`;
  }
  if (record.hits * 2 < record.checked) {
    // Honest about a bad run: the number is the point, not the boast.
    return `Right ${record.hits} of the last ${record.checked} — ${who} is changing rhythm.`;
  }
  return `Right ${record.hits} of the last ${record.checked} times, ${record.typicalMiss === 0 ? "on the minute" : `within ${record.typicalMiss} minutes`}.`;
}

/** A run worth offering a share button on: earned, not flattering. */
export function worthSharing(record: RhythmRecord): boolean {
  return record.checked >= 6 && record.hits * 10 >= record.checked * 8;
}
