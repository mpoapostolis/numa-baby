import { describe, expect, it } from "vitest";
import { buildVisitSummary } from "@/domain/visitSummary";
import { Activity } from "@/domain/types";

// A wrong figure on a sheet a doctor reads is the worst failure this app can
// have, so these lock the arithmetic AND the honesty about missing days.

const NOW = Date.parse("2026-08-28T20:00:00");
const day = (offset: number, hour = 9) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

let seq = 0;
const make = (partial: Partial<Activity> & Pick<Activity, "type">): Activity => {
  seq += 1;
  return { id: `x${seq}`, startedAt: day(0), ...partial } as Activity;
};

describe("buildVisitSummary", () => {
  it("reports blank days instead of averaging them away", () => {
    // Two logged days inside a seven-day window.
    const summary = buildVisitSummary(
      [
        make({ type: "bottle", startedAt: day(1), amount: 100 }),
        make({ type: "bottle", startedAt: day(2), amount: 100 }),
      ],
      NOW,
      7,
    );
    expect(summary.loggedDays).toBe(2);
    expect(summary.blankDays).toBe(5);
    // The median is over the days that were logged, not over seven.
    expect(summary.mlPerDay).toBe(100);
  });

  it("totals the window exactly", () => {
    const summary = buildVisitSummary(
      [
        make({ type: "bottle", startedAt: day(1), amount: 90 }),
        make({ type: "bottle", startedAt: day(1, 14), amount: 110 }),
        make({ type: "diaper", startedAt: day(1), diaperKind: "both" }),
        make({ type: "diaper", startedAt: day(2), diaperKind: "wet" }),
      ],
      NOW,
      7,
    );
    expect(summary.totalMl).toBe(200);
    expect(summary.totalFeeds).toBe(2);
    // "both" counts once as a change but in each of wet and dirty.
    expect(summary.totalWet).toBe(2);
    expect(summary.totalDirty).toBe(1);
  });

  it("computes weekly gain only from two weights at least a day apart", () => {
    const one = buildVisitSummary(
      [make({ type: "growth", startedAt: day(14), weightGrams: 3800 })],
      NOW,
      14,
    );
    expect(one.gramsPerWeek).toBeNull();
    expect(one.latestWeightGrams).toBe(3800);

    const two = buildVisitSummary(
      [
        make({ type: "growth", startedAt: day(14), weightGrams: 3800 }),
        make({ type: "growth", startedAt: day(0), weightGrams: 4200 }),
      ],
      NOW,
      14,
    );
    // 400 g over 14 days = 200 g a week.
    expect(two.gramsPerWeek).toBe(200);
    expect(two.previousWeightGrams).toBe(3800);
  });

  it("answers null rather than zero when the log cannot say", () => {
    const summary = buildVisitSummary([], NOW, 14);
    expect(summary.feedsPerDay).toBeNull();
    expect(summary.mlPerDay).toBeNull();
    expect(summary.wetPerDay).toBeNull();
    expect(summary.gramsPerWeek).toBeNull();
    expect(summary.blankDays).toBe(14);
  });
});
