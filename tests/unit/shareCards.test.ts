import { describe, expect, it } from "vitest";
import { dayCard, milestoneCard, visitCard, weekCard, WeekDay } from "@/domain/shareCards";
import { lifetimeTotals } from "@/domain/lifetime";
import { summarizeDay } from "@/domain/daySummary";
import { buildVisitSummary } from "@/domain/visitSummary";
import { Activity } from "@/domain/types";

// What goes on the pictures a parent shares. Pure builders; the canvas that
// draws them is not under test here.

function feed(id: string, startedAt: string, amount?: number): Activity {
  return amount === undefined
    ? { id, type: "nursing", startedAt, endedAt: new Date(new Date(startedAt).getTime() + 15 * 60_000).toISOString(), side: "left" }
    : { id, type: "bottle", startedAt, amount, milkType: "formula" };
}

function day(offset: number, feeds: Activity[], diapers: number, sleep: number): WeekDay {
  const date = new Date(2026, 7, 25 + offset, 12);
  return { date, feeds, ml: feeds.reduce((sum, f) => sum + (f.amount ?? 0), 0), diapers, sleep };
}

const MILESTONE = { id: "m1", title: "Mia is 1 month old today", sub: "The first of many month-birthdays." };

describe("milestoneCard", () => {
  it("puts the party's own words on the card, dated, and nothing else on an empty log", () => {
    const card = milestoneCard(MILESTONE, new Date(2026, 8, 1, 9).getTime());
    expect(card.headline).toBe("Mia is 1 month old today");
    expect(card.sub).toBe("The first of many month-birthdays.");
    expect(card.eyebrow).toMatch(/September/);
    expect(card.stats).toBeUndefined();
    expect(card.footnote).toBeUndefined();
  });

  it("counts everything since day one, skipping tombstones and forgotten timers", () => {
    const log: Activity[] = [
      feed("a", "2026-08-02T08:00:00", 90),
      feed("b", "2026-08-02T12:00:00"),
      { ...feed("c", "2026-08-03T08:00:00", 120), deleted: true },
      { id: "d", type: "diaper", diaperKind: "wet", startedAt: "2026-08-02T09:00:00" },
      { id: "e", type: "diaper", diaperKind: "both", startedAt: "2026-08-02T15:00:00" },
      { id: "f", type: "sleep", startedAt: "2026-08-02T20:00:00", endedAt: "2026-08-02T23:30:00" },
      { id: "g", type: "sleep", startedAt: "2026-08-03T20:00:00" },
      { id: "h", type: "sleep", startedAt: "2026-08-04T20:00:00", endedAt: "2026-08-07T20:00:00" },
    ];
    expect(lifetimeTotals(log)).toEqual({ feeds: 2, nappies: 2, sleepMinutes: 210, ml: 90 });
    const card = milestoneCard(MILESTONE, new Date(2026, 8, 1, 9).getTime(), lifetimeTotals(log), "metric");
    expect(card.stats).toEqual([
      { value: "2", label: "feeds" },
      { value: "2", label: "nappies" },
      { value: "4h", label: "asleep" },
      { value: "90 ml", label: "of milk" },
    ]);
    expect(card.footnote).toMatch(/since day one/);
  });

  it("speaks litres once the milk adds up", () => {
    const bottles: Activity[] = Array.from({ length: 120 }, (_, i) => feed(`b${i}`, "2026-08-02T08:00:00", 100));
    expect(milestoneCard(MILESTONE, Date.now(), lifetimeTotals(bottles), "metric").stats?.[1]).toEqual({ value: "12.0 L", label: "of milk" });
    expect(milestoneCard(MILESTONE, Date.now(), lifetimeTotals(bottles), "us").stats?.[1]).toEqual({ value: "405.8 oz", label: "of milk" });
  });
});

describe("dayCard", () => {
  const dayLog: Activity[] = [
    feed("a", "2026-08-25T06:10:00", 90),
    feed("b", "2026-08-25T10:00:00"),
    feed("c", "2026-08-25T23:40:00", 120),
    { id: "d", type: "diaper", diaperKind: "wet", startedAt: "2026-08-25T07:00:00" },
    { id: "e", type: "diaper", diaperKind: "both", startedAt: "2026-08-25T15:00:00" },
    { id: "f", type: "sleep", startedAt: "2026-08-25T13:00:00", endedAt: "2026-08-25T14:30:00" },
    { id: "g", type: "sleep", startedAt: "2026-08-25T20:00:00", endedAt: "2026-08-25T22:00:00" },
  ];

  it("names the weekday and carries the day's figures", () => {
    const summary = summarizeDay(dayLog, new Date(2026, 7, 25), new Date(2026, 7, 26, 9).getTime());
    const card = dayCard("Mia", summary, "metric");
    expect(card.headline).toBe("Mia’s Tuesday");
    expect(card.eyebrow).toBe("Tuesday, August 25");
    expect(card.sub).toBe("Feeds from 06:10 to 23:40.");
    expect(card.stats).toEqual([
      { value: "3", label: "feeds" },
      { value: "210 ml", label: "of milk" },
      { value: "2", label: "wet" },
      { value: "1", label: "dirty" },
      { value: "3h 30m", label: "asleep" },
      { value: "2h", label: "longest sleep" },
    ]);
  });

  it("says 'so far' while the day is still being lived, and shows time nursed on a breast-only day", () => {
    const nursingOnly = dayLog.filter((a) => a.type !== "bottle");
    const summary = summarizeDay(nursingOnly, new Date(2026, 7, 25), new Date(2026, 7, 25, 16).getTime());
    const card = dayCard("", summary, "us");
    expect(card.eyebrow).toBe("Today so far · Tuesday, August 25");
    expect(card.headline).toBe("Baby’s Tuesday");
    expect(card.stats?.slice(0, 2)).toEqual([
      { value: "1", label: "feed" },
      { value: "15m", label: "nursed" },
    ]);
  });
});

describe("weekCard", () => {
  const week = [
    day(0, [feed("a", "2026-08-25T08:00:00", 90), feed("b", "2026-08-25T12:00:00")], 5, 600),
    day(1, [feed("c", "2026-08-26T08:00:00", 120)], 4, 540),
    day(2, [], 0, 0),
    day(3, [feed("d", "2026-08-28T08:00:00", 90)], 6, 0),
    day(4, [], 3, 0),
    day(5, [], 0, 0),
    day(6, [feed("e", "2026-08-31T08:00:00", 90)], 5, 660),
  ];

  it("totals the week and says how much of it was logged", () => {
    const card = weekCard("Mia", week, "metric");
    expect(card.headline).toBe("Mia’s week");
    expect(card.eyebrow).toBe("This week · Aug 25 – Aug 31");
    expect(card.stats).toEqual([
      { value: "5", label: "feeds" },
      { value: "23", label: "nappies" },
      { value: "30h", label: "asleep" },
      { value: "390 ml", label: "of milk" },
    ]);
    expect(card.sub).toBe("5 of 7 days logged.");
  });

  it("leaves out figures the family does not track, and speaks the phone's units", () => {
    const nursingOnly = week.map((d) => ({ ...d, feeds: d.feeds.filter((f) => f.type === "nursing"), ml: 0, sleep: 0 }));
    const card = weekCard("", nursingOnly, "us");
    expect(card.headline).toBe("Baby’s week");
    expect(card.stats?.map((s) => s.label)).toEqual(["feed", "nappies"]);
    expect(weekCard("Mia", week, "us").stats?.[3]).toEqual({ value: "13.2 oz", label: "of milk" });
  });
});

describe("visitCard", () => {
  it("carries the paediatrician's figures and the honesty line", () => {
    const now = new Date(2026, 8, 1, 10).getTime();
    const activities: Activity[] = [
      feed("a", "2026-08-31T08:00:00", 100),
      feed("b", "2026-08-31T12:00:00", 100),
      { id: "d1", type: "diaper", diaperKind: "wet", startedAt: "2026-08-31T09:00:00" },
      { id: "g1", type: "growth", startedAt: "2026-08-24T09:00:00", weightGrams: 4000 },
      { id: "g2", type: "growth", startedAt: "2026-08-31T09:00:00", weightGrams: 4200 },
    ];
    const card = visitCard(buildVisitSummary(activities, now, 14), "Mia", "5 weeks", "metric");
    expect(card.eyebrow).toBe("For the paediatrician");
    expect(card.headline).toBe("Mia, 5 weeks old");
    expect(card.sub).toBe("Aug 19 – Sep 1 · 1 of 14 days logged");
    expect(card.stats).toEqual([
      { value: "2", label: "feeds a day" },
      { value: "200 ml", label: "milk a day" },
      { value: "1", label: "wet a day" },
      { value: "0", label: "dirty a day" },
      { value: "4.20 kg", label: "latest weight" },
      { value: "200 g", label: "gained a week" },
    ]);
    expect(card.footnote).toMatch(/not a clinical measurement/);
  });
});
