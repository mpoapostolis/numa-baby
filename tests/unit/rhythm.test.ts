import { describe, expect, it } from "vitest";
import { FEED_BOUNDS } from "@/domain/forecast";
import { MIN_SCORED_CALLS, SCORED_WINDOW, rhythmLine, rhythmRecord, stepsFromMoments, worthSharing } from "@/domain/rhythm";

// The app scoring its own guesses. The whole value is that it cannot flatter
// itself: every call is recomputed from the log that existed at the time.

const HOUR = 3_600_000;
const base = new Date(2026, 7, 25, 6, 0).getTime();

/** Feeds every three hours, with each gap nudged by `drift` minutes. */
function feeds(count: number, drift: (index: number) => number = () => 0): number[] {
  const out = [base];
  for (let i = 1; i < count; i += 1) out.push(out[i - 1] + 3 * HOUR + drift(i) * 60_000);
  return out;
}

describe("rhythmRecord", () => {
  it("scores nothing until there are more feeds than the forecast needs", () => {
    const record = rhythmRecord("feed", stepsFromMoments(feeds(3)), FEED_BOUNDS);
    expect(record.checked).toBe(0);
    expect(rhythmLine(record, "Mia")).toBeNull();
  });

  it("calls a metronome right every time", () => {
    const record = rhythmRecord("feed", stepsFromMoments(feeds(12)), FEED_BOUNDS);
    expect(record.checked).toBe(8);
    expect(record.hits).toBe(8);
    expect(record.typicalMiss).toBe(0);
    expect(rhythmLine(record, "Mia")).toBe("Right every one of the last 8 times.");
  });

  it("scores the recent stretch, not a lifetime average", () => {
    const record = rhythmRecord("feed", stepsFromMoments(feeds(40)), FEED_BOUNDS);
    expect(record.checked).toBe(SCORED_WINDOW);
  });

  it("counts a miss when the feed lands outside the window, and says how far out it usually is", () => {
    // Steady three-hourly, then one feed two hours late: outside any window
    // the 15-45 minute spread can draw.
    const times = feeds(10);
    times[9] += 2 * HOUR;
    const record = rhythmRecord("feed", stepsFromMoments(times), FEED_BOUNDS);
    expect(record.checked).toBe(6);
    expect(record.hits).toBe(5);
    expect(record.recent[0]).toMatchObject({ hit: false, offBy: 120 });
    expect(rhythmLine(record, "Mia")).toMatch(/^Right 5 of the last 6 times, /);
  });

  it("says the rhythm is changing rather than boasting, when it is mostly wrong", () => {
    // Alternating 1h and 5h gaps: the median is no use to anybody.
    const times = [base];
    for (let i = 1; i < 12; i += 1) times.push(times[i - 1] + (i % 2 ? 1 : 5) * HOUR);
    const record = rhythmRecord("feed", stepsFromMoments(times), FEED_BOUNDS);
    expect(record.checked).toBeGreaterThanOrEqual(MIN_SCORED_CALLS);
    expect(record.hits * 2).toBeLessThan(record.checked);
    expect(rhythmLine(record, "")).toMatch(/your baby is changing rhythm\.$/);
  });

  it("offers the share only on a run that earned it", () => {
    // A metronome: eight calls, all right.
    expect(worthSharing(rhythmRecord("feed", stepsFromMoments(feeds(12)), FEED_BOUNDS))).toBe(true);
    // Five calls is a good run nobody should be bragging about yet.
    expect(worthSharing(rhythmRecord("feed", stepsFromMoments(feeds(8)), FEED_BOUNDS))).toBe(false);
    // Plenty of calls, but four in five is not a story.
    const shaky = { kind: "feed" as const, checked: 10, hits: 7, typicalMiss: 20, recent: [] };
    expect(worthSharing(shaky)).toBe(false);
  });

  it("keeps only the newest calls, newest first", () => {
    const record = rhythmRecord("feed", stepsFromMoments(feeds(20)), FEED_BOUNDS, 3);
    expect(record.recent).toHaveLength(3);
    expect(record.recent[0].actual).toBeGreaterThan(record.recent[1].actual);
  });
});
