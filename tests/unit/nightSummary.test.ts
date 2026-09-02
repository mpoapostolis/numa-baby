import { describe, expect, it } from "vitest";
import { isMorning, nightWindow, summarizeNight } from "@/domain/nightSummary";
import { Activity } from "@/domain/types";

// "How was the night?" — answered from the log, for the morning after.

const iso = (day: number, hour: number, minute = 0) => new Date(2026, 7, day, hour, minute).toISOString();
const morningOf26 = new Date(2026, 7, 26, 7, 30).getTime();

function sleep(id: string, from: string, to?: string): Activity {
  return { id, type: "sleep", startedAt: from, endedAt: to };
}

describe("summarizeNight", () => {
  it("runs 19:00 to 07:00 and belongs to the morning it ended on", () => {
    const { from, to, morning } = nightWindow(morningOf26);
    expect(from.getDate()).toBe(25);
    expect(from.getHours()).toBe(19);
    expect(to.getDate()).toBe(26);
    expect(to.getHours()).toBe(7);
    expect(morning.getDate()).toBe(26);
  });

  it("adds the stretches, names the longest, and counts the wakings between them", () => {
    const log: Activity[] = [
      sleep("s1", iso(25, 20, 0), iso(26, 0, 10)),
      { id: "f1", type: "nursing", startedAt: iso(26, 0, 20), endedAt: iso(26, 0, 38), side: "left" },
      { id: "d1", type: "diaper", diaperKind: "wet", startedAt: iso(26, 0, 40) },
      sleep("s2", iso(26, 0, 50), iso(26, 3, 30)),
      { id: "f2", type: "bottle", startedAt: iso(26, 3, 40), amount: 90, milkType: "formula" },
      sleep("s3", iso(26, 4, 0), iso(26, 6, 45)),
    ];
    const night = summarizeNight(log, morningOf26)!;
    expect(night.sleepMinutes).toBe(250 + 160 + 165);
    expect(night.longestStretchMinutes).toBe(250);
    expect(night.wakeUps).toBe(2);
    expect(night.feeds).toBe(2);
    expect(night.diapers).toBe(1);
    expect(night.firstFeedAt).toBe(iso(26, 0, 20));
    expect(night.lastFeedAt).toBe(iso(26, 3, 40));
  });

  it("counts only the minutes inside the night for a sleep that straddles either end", () => {
    const log = [sleep("s1", iso(25, 18, 0), iso(25, 20, 0)), sleep("s2", iso(26, 6, 0), iso(26, 9, 0))];
    const night = summarizeNight(log, morningOf26)!;
    // 19:00-20:00 of the first, 06:00-07:00 of the second.
    expect(night.sleepMinutes).toBe(120);
    expect(night.longestStretchMinutes).toBe(60);
  });

  it("ignores undone entries and a night with nothing in it", () => {
    expect(summarizeNight([{ ...sleep("s1", iso(25, 21, 0), iso(26, 5, 0)), deleted: true }], morningOf26)).toBeNull();
    expect(summarizeNight([], morningOf26)).toBeNull();
    expect(summarizeNight([sleep("s1", iso(26, 13, 0), iso(26, 14, 0))], morningOf26)).toBeNull();
  });

  it("counts a timer still running up to now, never past the morning", () => {
    const night = summarizeNight([sleep("s1", iso(26, 5, 30))], new Date(2026, 7, 26, 6, 0).getTime())!;
    expect(night.sleepMinutes).toBe(30);
  });

  it("is a morning card, not an all-day one", () => {
    expect(isMorning(new Date(2026, 7, 26, 7, 30).getTime())).toBe(true);
    expect(isMorning(new Date(2026, 7, 26, 4, 0).getTime())).toBe(false);
    expect(isMorning(new Date(2026, 7, 26, 15, 0).getTime())).toBe(false);
  });
});
