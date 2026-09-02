import { describe, expect, it } from "vitest";
import { milestoneCard, visitCard, weekCard, WeekDay } from "@/domain/shareCards";
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

describe("milestoneCard", () => {
  it("puts the party's own words on the card, dated", () => {
    const card = milestoneCard({ id: "m1", title: "Mia is 1 month old today", sub: "The first of many month-birthdays." }, new Date(2026, 8, 1, 9).getTime());
    expect(card.headline).toBe("Mia is 1 month old today");
    expect(card.sub).toBe("The first of many month-birthdays.");
    expect(card.eyebrow).toMatch(/September/);
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
