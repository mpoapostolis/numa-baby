import { describe, expect, it } from "vitest";
import { summarizeDay } from "@/domain/daySummary";
import { Activity } from "@/domain/types";

// Local-time ISO strings (no trailing Z) keep every case timezone-agnostic.
const day = new Date(2026, 7, 12); // 12 Aug 2026, local
const now = Date.parse("2026-08-12T20:00:00");

let seq = 0;
function make(partial: Partial<Activity> & Pick<Activity, "type" | "startedAt">): Activity {
  seq += 1;
  return { id: `a${seq}`, ...partial } as Activity;
}

describe("summarizeDay", () => {
  it("returns an empty summary for a day with nothing logged", () => {
    const summary = summarizeDay([], day, now);
    expect(summary.isEmpty).toBe(true);
    expect(summary.feeds).toBe(0);
    expect(summary.wet).toBe(0);
    expect(summary.sleepMinutes).toBe(0);
    expect(summary.isToday).toBe(true);
  });

  it("counts a 'both' diaper as one change but as wet AND dirty", () => {
    const summary = summarizeDay(
      [
        make({ type: "diaper", startedAt: "2026-08-12T08:00:00", diaperKind: "wet" }),
        make({ type: "diaper", startedAt: "2026-08-12T11:00:00", diaperKind: "both" }),
        make({ type: "diaper", startedAt: "2026-08-12T14:00:00", diaperKind: "dirty" }),
      ],
      day,
      now,
    );
    expect(summary.diapers).toBe(3);
    expect(summary.wet).toBe(2);
    expect(summary.dirty).toBe(2);
  });

  it("splits feeds by kind, totals millilitres and brackets the day", () => {
    const summary = summarizeDay(
      [
        make({ type: "bottle", startedAt: "2026-08-12T06:10:00", amount: 90 }),
        make({ type: "bottle", startedAt: "2026-08-12T18:40:00", amount: 110 }),
        make({
          type: "nursing",
          startedAt: "2026-08-12T12:00:00",
          endedAt: "2026-08-12T12:18:00",
          side: "left",
        }),
      ],
      day,
      now,
    );
    expect(summary.feeds).toBe(3);
    expect(summary.bottles).toBe(2);
    expect(summary.nursings).toBe(1);
    expect(summary.ml).toBe(200);
    expect(summary.nursingMinutes).toBe(18);
    expect(summary.firstFeedAt).toBe("2026-08-12T06:10:00");
    expect(summary.lastFeedAt).toBe("2026-08-12T18:40:00");
  });

  it("ignores bottles logged without an amount in the millilitre total", () => {
    const summary = summarizeDay(
      [make({ type: "bottle", startedAt: "2026-08-12T09:00:00" })],
      day,
      now,
    );
    expect(summary.feeds).toBe(1);
    expect(summary.ml).toBe(0);
  });

  it("splits an overnight sleep across both days", () => {
    const overnight = make({
      type: "sleep",
      startedAt: "2026-08-11T23:00:00",
      endedAt: "2026-08-12T06:00:00",
    });
    const before = summarizeDay([overnight], new Date(2026, 7, 11), now);
    const after = summarizeDay([overnight], day, now);
    expect(before.sleepMinutes).toBe(60);
    expect(after.sleepMinutes).toBe(360);
    expect(after.longestSleepMinutes).toBe(360);
  });

  it("gives an overnight feed — count AND minutes — to the day it started", () => {
    const overnightNursing = make({
      type: "nursing",
      startedAt: "2026-08-11T23:50:00",
      endedAt: "2026-08-12T00:10:00",
      side: "right",
    });
    const before = summarizeDay([overnightNursing], new Date(2026, 7, 11), now);
    const after = summarizeDay([overnightNursing], day, now);
    expect(before.feeds).toBe(1);
    expect(before.nursingMinutes).toBe(20);
    // "0 feeds · 10m nursing" on the next day would read as a bug.
    expect(after.feeds).toBe(0);
    expect(after.nursingMinutes).toBe(0);
  });

  it("reads a diaper logged without a kind as wet, like every other screen", () => {
    const summary = summarizeDay(
      [make({ type: "diaper", startedAt: "2026-08-12T08:00:00" })],
      day,
      now,
    );
    expect(summary.diapers).toBe(1);
    expect(summary.wet).toBe(1);
    expect(summary.dirty).toBe(0);
  });

  it("survives a corrupt span whose end precedes its start", () => {
    const summary = summarizeDay(
      [make({
        type: "sleep",
        startedAt: "2026-08-12T15:00:00",
        endedAt: "2026-08-12T14:00:00",
      })],
      day,
      now,
    );
    expect(summary.sleepMinutes).toBe(0);
    expect(summary.naps).toBe(1);
  });

  it("does not let a zero-length sleep displace the longest stretch", () => {
    const summary = summarizeDay(
      [
        make({ type: "sleep", startedAt: "2026-08-12T13:00:00", endedAt: "2026-08-12T15:30:00" }),
        make({ type: "sleep", startedAt: "2026-08-12T16:00:00", endedAt: "2026-08-12T16:00:00" }),
      ],
      day,
      now,
    );
    expect(summary.naps).toBe(2);
    expect(summary.longestSleepMinutes).toBe(150);
  });

  it("is order-independent", () => {
    const acts = [
      make({ type: "bottle", startedAt: "2026-08-12T09:00:00", amount: 100 }),
      make({ type: "diaper", startedAt: "2026-08-12T07:00:00", diaperKind: "both" }),
      make({ type: "sleep", startedAt: "2026-08-12T11:00:00", endedAt: "2026-08-12T12:00:00" }),
    ];
    const forward = summarizeDay(acts, day, now);
    const backward = summarizeDay([...acts].reverse(), day, now);
    expect(backward).toEqual(forward);
  });

  it("returns zeros for a future day rather than throwing", () => {
    const summary = summarizeDay(
      [make({ type: "bottle", startedAt: "2026-08-12T09:00:00", amount: 100 })],
      new Date(2026, 7, 20),
      now,
    );
    expect(summary.isEmpty).toBe(true);
    expect(summary.ml).toBe(0);
  });

  it("clamps a running timer to now and flags it", () => {
    const summary = summarizeDay(
      [make({ type: "sleep", startedAt: "2026-08-12T18:30:00" })],
      day,
      now,
    );
    expect(summary.sleepMinutes).toBe(90);
    expect(summary.naps).toBe(1);
    expect(summary.hasRunningTimer).toBe(true);
  });

  it("tracks the longest stretch separately from the total", () => {
    const summary = summarizeDay(
      [
        make({ type: "sleep", startedAt: "2026-08-12T09:00:00", endedAt: "2026-08-12T09:40:00" }),
        make({ type: "sleep", startedAt: "2026-08-12T13:00:00", endedAt: "2026-08-12T15:30:00" }),
      ],
      day,
      now,
    );
    expect(summary.naps).toBe(2);
    expect(summary.sleepMinutes).toBe(190);
    expect(summary.longestSleepMinutes).toBe(150);
  });

  it("counts growth and health entries without touching the care figures", () => {
    const summary = summarizeDay(
      [
        make({ type: "growth", startedAt: "2026-08-12T10:00:00", weightGrams: 4200 }),
        make({ type: "health", startedAt: "2026-08-12T10:05:00", temperatureC: 37.1 }),
      ],
      day,
      now,
    );
    expect(summary.growthEntries).toBe(1);
    expect(summary.healthEntries).toBe(1);
    expect(summary.feeds).toBe(0);
    expect(summary.isEmpty).toBe(false);
  });

  it("keeps other days out of the summary", () => {
    const summary = summarizeDay(
      [
        make({ type: "diaper", startedAt: "2026-08-11T23:59:00", diaperKind: "wet" }),
        make({ type: "diaper", startedAt: "2026-08-13T00:01:00", diaperKind: "wet" }),
      ],
      day,
      now,
    );
    expect(summary.diapers).toBe(0);
    expect(summary.isEmpty).toBe(true);
  });

  it("marks a past day as not today", () => {
    expect(summarizeDay([], new Date(2026, 7, 10), now).isToday).toBe(false);
  });
});
