import { describe, expect, it } from "vitest";
import { DaySummary } from "@/domain/daySummary";
import {
  MAX_INSIGHTS,
  InsightInput,
  buildInsightInput,
  feverThresholdC,
  insightsFor,
} from "@/domain/insightRules";
import { Activity } from "@/domain/types";

// The invariants that make it safe to put these cards in front of a
// frightened parent: never today, never on thin data, never a diagnosis.

const NOW = Date.parse("2026-08-22T18:00:00");

function day(offsetFromToday: number, fields: Partial<DaySummary> = {}): DaySummary {
  const date = new Date(NOW);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - offsetFromToday);
  return {
    date,
    isToday: offsetFromToday === 0,
    hasRunningTimer: false,
    hasStaleTimer: false,
    feeds: 0,
    bottles: 0,
    nursings: 0,
    ml: 0,
    nursingMinutes: 0,
    diapers: 0,
    wet: 0,
    dirty: 0,
    both: 0,
    sleepMinutes: 0,
    naps: 0,
    longestSleepMinutes: 0,
    growthEntries: 0,
    healthEntries: 0,
    isEmpty: false,
    ...fields,
  };
}

function input(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    ageDays: 30,
    ageMonths: 1,
    feedingMode: "mixed",
    days: [],
    weights: [],
    recentBottleMl: [],
    recentBurps: 0,
    now: NOW,
    ...overrides,
  };
}

/** Seven complete days that all look ordinary for a well-logged newborn. */
function ordinaryWeek(fields: Partial<DaySummary> = {}): DaySummary[] {
  return [7, 6, 5, 4, 3, 2, 1].map((offset) =>
    day(offset, { feeds: 9, bottles: 9, ml: 700, diapers: 7, wet: 7, dirty: 2, ...fields }),
  );
}

describe("feverThresholdC", () => {
  it.each([
    ["a newborn", 10, 38.0],
    ["just under 3 months", 89, 38.0],
    ["3 to 6 months", 120, 38.3],
    ["over 6 months", 200, 39.4],
  ])("uses the AAP threshold for %s", (_label, ageDays, expected) => {
    expect(feverThresholdC(ageDays)).toBe(expected);
  });

  it("fails safe to the newborn threshold when the age is unknown", () => {
    expect(feverThresholdC(null)).toBe(38.0);
  });
});

describe("insightsFor", () => {
  it("says nothing at all on an empty tracker", () => {
    expect(insightsFor(input())).toEqual([]);
  });

  it("never returns more than three cards", () => {
    const found = insightsFor(input({
      ageDays: 30,
      days: ordinaryWeek({ wet: 4 }),
      latestTemperatureC: 39,
      latestTemperatureAt: "2026-08-22T17:00:00",
    }));
    expect(found.length).toBeLessThanOrEqual(MAX_INSIGHTS);
  });

  it("puts a seek-care card above every reassurance", () => {
    const found = insightsFor(input({
      ageDays: 30,
      days: ordinaryWeek({ feeds: 10, wet: 4 }),
    }));
    expect(found[0].tone).toBe("seek-care");
    const tones = found.map((f) => f.tone);
    expect(tones.indexOf("seek-care")).toBeLessThan(
      tones.includes("reassure") ? tones.indexOf("reassure") : Infinity,
    );
  });

  it("every card names what to do and where it came from", () => {
    for (const card of insightsFor(input({ ageDays: 30, days: ordinaryWeek() }))) {
      expect(card.advice.length).toBeGreaterThan(15);
      expect(card.sources.length).toBeGreaterThan(0);
      for (const source of card.sources) expect(source.url).toMatch(/^https:\/\//);
    }
  });
});

describe("the low-nappy rules", () => {
  it("fire on yesterday's count once nappies are being logged", () => {
    const found = insightsFor(input({ ageDays: 30, days: ordinaryWeek({ wet: 4 }) }));
    expect(found.some((f) => f.id === "wet-nappies-below-six")).toBe(true);
  });

  it("stay silent when nappies are barely logged at all", () => {
    // Only two of seven days carry a nappy: the low count is a logging gap.
    const sparse = ordinaryWeek({ diapers: 0, wet: 0, dirty: 0 });
    sparse[5] = day(2, { feeds: 9, diapers: 5, wet: 5 });
    sparse[6] = day(1, { feeds: 9, diapers: 4, wet: 4 });
    const found = insightsFor(input({ ageDays: 30, days: sparse }));
    expect(found.some((f) => f.id.startsWith("wet-nappies"))).toBe(false);
  });

  it("stay silent in the first week, when a low count is expected", () => {
    const found = insightsFor(input({ ageDays: 4, days: ordinaryWeek({ wet: 2 }) }));
    expect(found.some((f) => f.id.startsWith("wet-nappies"))).toBe(false);
  });

  it("are mutually exclusive", () => {
    const found = insightsFor(input({ ageDays: 30, days: ordinaryWeek({ wet: 1 }) }));
    const ids = found.map((f) => f.id);
    expect(ids).toContain("wet-nappies-very-low");
    expect(ids).not.toContain("wet-nappies-below-six");
  });
});

describe("the temperature rules", () => {
  it("fire on a fresh reading over the age threshold", () => {
    const found = insightsFor(input({
      ageDays: 30,
      latestTemperatureC: 38.2,
      latestTemperatureAt: "2026-08-22T17:30:00",
    }));
    expect(found[0].id).toBe("fever-for-age");
    expect(found[0].tone).toBe("seek-care");
  });

  it("ignore a reading older than a day", () => {
    const found = insightsFor(input({
      ageDays: 30,
      latestTemperatureC: 38.2,
      latestTemperatureAt: "2026-08-19T17:30:00",
    }));
    expect(found).toEqual([]);
  });

  it("do not fire at 38.2 for a six-month-old", () => {
    const found = insightsFor(input({
      ageDays: 200,
      ageMonths: 6,
      latestTemperatureC: 38.2,
      latestTemperatureAt: "2026-08-22T17:30:00",
    }));
    expect(found.some((f) => f.id === "fever-for-age")).toBe(false);
  });

  it("treat a low newborn temperature as urgent too", () => {
    const found = insightsFor(input({
      ageDays: 20,
      latestTemperatureC: 35.6,
      latestTemperatureAt: "2026-08-22T17:30:00",
    }));
    expect(found.some((f) => f.id === "low-temperature-newborn")).toBe(true);
  });

  it("ignore an obviously mistyped reading rather than shouting about it", () => {
    for (const value of [3.6, 45]) {
      const found = insightsFor(input({
        ageDays: 20,
        latestTemperatureC: value,
        latestTemperatureAt: "2026-08-22T17:30:00",
      }));
      expect(found.some((f) => f.tone === "seek-care")).toBe(false);
    }
  });
});

describe("buildInsightInput", () => {
  const activities: Activity[] = [
    { id: "1", type: "bottle", startedAt: "2026-08-22T09:00:00", amount: 120 },
    { id: "2", type: "diaper", startedAt: "2026-08-21T09:00:00", diaperKind: "both" },
    { id: "3", type: "health", startedAt: "2026-08-22T08:00:00", temperatureC: 37.2 },
    { id: "4", type: "growth", startedAt: "2026-08-01T08:00:00", weightGrams: 3400 },
    { id: "5", type: "growth", startedAt: "2026-08-15T08:00:00", weightGrams: 3900 },
    { id: "6", type: "burp", startedAt: "2026-08-22T09:10:00", endedAt: "2026-08-22T09:14:00" },
  ];
  const built = buildInsightInput({
    activities,
    recentDays: [day(2), day(1), day(0)],
    ageDays: 30,
    ageMonths: 1,
    feedingMode: "mixed",
    now: NOW,
  });

  it("strips today from the countable days", () => {
    expect(built.days).toHaveLength(2);
    expect(built.days.some((d) => d.isToday)).toBe(false);
  });

  it("finds the latest of each thing the rules ask about", () => {
    expect(built.lastFeedAt).toBe("2026-08-22T09:00:00");
    expect(built.lastDirtyAt).toBe("2026-08-21T09:00:00");
    expect(built.latestTemperatureC).toBe(37.2);
    expect(built.recentBottleMl).toEqual([120]);
    expect(built.recentBurps).toBe(1);
  });

  it("returns weights oldest first, so the first is the earliest logged", () => {
    expect(built.weights.map((w) => w.weightGrams)).toEqual([3400, 3900]);
  });
});

describe("rules that read change rather than thresholds", () => {
  // A week where nothing crosses a clinical line, but something has clearly
  // moved. Absolute rules are blind to all of this by design.
  const week = (feeds: number, wet: number, longest: number) => ({
    feeds,
    bottles: feeds,
    diapers: wet,
    wet,
    longestSleepMinutes: longest,
    naps: 1,
  });

  /** Oldest first, one per complete day, all of them carrying a log. */
  function daysFrom(specs: Array<ReturnType<typeof week>>) {
    return specs.map((spec, index) => day(specs.length - index, spec));
  }

  it("notices feeds easing off without calling it an emergency", () => {
    const insights = insightsFor(
      input({
        days: daysFrom([
          week(14, 8, 120), week(14, 8, 120), week(13, 8, 120),
          week(9, 8, 120), week(9, 8, 120), week(8, 8, 120),
        ]),
      }),
    );
    const found = insights.find((i) => i.id === "feeds-fewer-than-they-were");
    expect(found).toBeDefined();
    expect(found?.tone).toBe("suggest");
    expect(found?.body).toContain("8.7");
  });

  it("stays quiet when the drop is small", () => {
    const insights = insightsFor(
      input({
        days: daysFrom([
          week(12, 8, 120), week(12, 8, 120), week(12, 8, 120),
          week(11, 8, 120), week(11, 8, 120), week(11, 8, 120),
        ]),
      }),
    );
    expect(insights.find((i) => i.id === "feeds-fewer-than-they-were")).toBeUndefined();
  });

  it("stays quiet when there are not two comparable windows", () => {
    const insights = insightsFor(
      input({ days: daysFrom([week(14, 8, 120), week(6, 8, 120)]) }),
    );
    expect(insights.find((i) => i.id === "feeds-fewer-than-they-were")).toBeUndefined();
  });

  it("says something good when the nights are lengthening", () => {
    const insights = insightsFor(
      input({
        days: daysFrom([
          week(10, 8, 90), week(10, 8, 90), week(10, 8, 96),
          week(10, 8, 180), week(10, 8, 186), week(10, 8, 192),
        ]),
      }),
    );
    const found = insights.find((i) => i.id === "longest-sleep-growing");
    expect(found?.tone).toBe("reassure");
    // A claim about this log only, so nothing is cited at it.
    expect(found?.sources).toEqual([]);
  });

  it("does not celebrate ten more minutes", () => {
    const insights = insightsFor(
      input({
        days: daysFrom([
          week(10, 8, 100), week(10, 8, 100), week(10, 8, 100),
          week(10, 8, 112), week(10, 8, 112), week(10, 8, 112),
        ]),
      }),
    );
    expect(insights.find((i) => i.id === "longest-sleep-growing")).toBeUndefined();
  });
});
