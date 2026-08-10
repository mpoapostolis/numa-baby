import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ageInDays,
  ageInMonths,
  forecastRelative,
  formatBabyAge,
  humanDuration,
  isSameDay,
  liveDuration,
  median,
  minutesOnDay,
  timeAgo,
} from "@/domain/time";

// Local-time ISO strings (no trailing Z) keep every case timezone-agnostic:
// the helpers parse them with the same local rules the app uses.

describe("minutesOnDay", () => {
  const overnightSleep = { startedAt: "2026-03-10T23:00:00", endedAt: "2026-03-11T06:00:00" };

  it.each([
    ["the day it started", new Date(2026, 2, 10), 60],
    ["the day it ended", new Date(2026, 2, 11), 360],
    ["an unrelated day", new Date(2026, 2, 12), 0],
  ])("counts an overnight sleep on %s", (_label, day, minutes) => {
    expect(minutesOnDay(overnightSleep, day, Date.parse("2026-03-12T12:00:00"))).toBe(minutes);
  });

  it("clamps an open-ended sleep at the provided now", () => {
    const open = { startedAt: "2026-03-11T04:00:00" };
    expect(minutesOnDay(open, new Date(2026, 2, 11), Date.parse("2026-03-11T05:30:00"))).toBe(90);
  });
});

describe("median", () => {
  it.each([
    ["empty", [], 0],
    ["odd length", [5, 1, 3], 3],
    ["even length rounds the midpoint", [10, 20, 25, 50], 23],
    ["unsorted input", [40, 10, 30, 20], 25],
  ])("%s", (_label, values, expected) => {
    expect(median(values)).toBe(expected);
  });
});

describe("humanDuration", () => {
  it.each([
    [59, "59m"],
    [60, "1h"],
    [61, "1h 1m"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(humanDuration(minutes)).toBe(expected);
  });
});

describe("ageInMonths", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["subtracts a month before the day-of-month is reached", "2026-05-20", 2],
    ["counts the full month on the day-of-month", "2026-05-07", 3],
    ["never goes negative", "2026-08-20", 0],
  ])("%s", (_label, birthDate, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 7, 12, 0, 0));
    expect(ageInMonths(birthDate)).toBe(expected);
  });

  it("returns null for an unparseable birth date", () => {
    expect(ageInMonths("not-a-date")).toBeNull();
  });
});

describe("isSameDay", () => {
  it.each([
    ["late evening of the same local date", "2026-11-01T23:30:00", new Date(2026, 10, 1), true],
    ["minutes past local midnight", "2026-11-02T00:10:00", new Date(2026, 10, 1), false],
    ["same day-of-month in another month", "2026-10-01T12:00:00", new Date(2026, 10, 1), false],
  ])("%s", (_label, value, day, expected) => {
    expect(isSameDay(value, day)).toBe(expected);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-08-07T12:00:00");

  it.each([
    ["missing value", undefined, "No entries yet"],
    ["under a minute", "2026-08-07T11:59:40", "just now"],
    ["minutes", "2026-08-07T11:15:00", "45m ago"],
    ["hours and minutes", "2026-08-07T09:30:00", "2h 30m ago"],
    ["days", "2026-08-04T12:00:00", "3d ago"],
  ])("%s", (_label, value, expected) => {
    expect(timeAgo(value, now)).toBe(expected);
  });
});

describe("forecastRelative", () => {
  const now = Date.parse("2026-08-07T12:00:00");

  it.each([
    ["31 minutes past the window", now - 31 * 60_000, "Past the usual window"],
    ["exactly 30 minutes past", now - 30 * 60_000, "Check cues now"],
    ["15 minutes ahead", now + 15 * 60_000, "Check cues now"],
    ["90 minutes ahead", now + 90 * 60_000, "Likely in 1h 30m"],
  ])("%s", (_label, target, expected) => {
    expect(forecastRelative(target, now)).toBe(expected);
  });
});

describe("liveDuration", () => {
  const start = "2026-08-07T10:00:00";

  it.each([
    ["just under an hour", "2026-08-07T10:59:59", "59:59"],
    ["exactly an hour rolls over", "2026-08-07T11:00:00", "1:00:00"],
    ["past an hour keeps the hour prefix", "2026-08-07T11:01:05", "1:01:05"],
  ])("%s", (_label, nowIso, expected) => {
    expect(liveDuration(start, Date.parse(nowIso))).toBe(expected);
  });
});

describe("formatBabyAge", () => {
  const birth = "2026-07-01T09:00:00";
  const at = (iso: string) => Date.parse(iso);

  it("returns null without a usable birth date", () => {
    const now = at("2026-08-10T12:00:00");
    expect(formatBabyAge(undefined, now)).toBeNull();
    expect(formatBabyAge("not-a-date", now)).toBeNull();
    expect(formatBabyAge("2026-09-01T00:00:00", now)).toBeNull();
  });

  it.each([
    ["born today", "2026-07-01T21:00:00", "born today"],
    ["one day", "2026-07-02T10:00:00", "1 day"],
    ["plain days in the first week", "2026-07-06T10:00:00", "5 days"],
    ["one week", "2026-07-08T10:00:00", "1 week"],
    ["weeks under two months", "2026-07-15T10:00:00", "2 weeks"],
    ["weeks past 8 while calendar months < 2", "2026-08-27T10:00:00", "8 weeks"],
    ["calendar months from two on", "2026-10-15T10:00:00", "3 months"],
  ])("%s", (_label, nowIso, expected) => {
    expect(formatBabyAge(birth, at(nowIso))).toBe(expected);
  });
});

describe("ageInDays", () => {
  const birth = "2026-07-01T09:00:00";

  it("counts whole days since birth", () => {
    expect(ageInDays(birth, Date.parse("2026-07-01T23:00:00"))).toBe(0);
    expect(ageInDays(birth, Date.parse("2026-07-02T08:59:00"))).toBe(0);
    expect(ageInDays(birth, Date.parse("2026-07-02T09:00:00"))).toBe(1);
    expect(ageInDays(birth, Date.parse("2026-08-10T10:00:00"))).toBe(40);
  });

  it("returns null without a usable birth date", () => {
    const now = Date.parse("2026-08-10T10:00:00");
    expect(ageInDays(undefined, now)).toBeNull();
    expect(ageInDays("nope", now)).toBeNull();
    expect(ageInDays("2026-09-01T00:00:00", now)).toBeNull();
  });
});
