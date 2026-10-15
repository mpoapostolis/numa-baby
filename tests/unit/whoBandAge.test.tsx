/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { VisitSummarySheet } from "@/components/VisitSummarySheet";
import { exactAgeInMonths } from "@/domain/time";
import { Activity, Profile } from "@/domain/types";
import { buildVisitSummary } from "@/domain/visitSummary";
import GrowthGuideScreen from "@/screens/GrowthGuideScreen";
import { stubBrowser } from "./appHarness";

// Two places where the WHO band and the weight beside it were read at
// different ages. The paediatrician summary took the band for the completed
// whole month, so a 26-day-old got the birth-day range and a median weight
// read as P97. The Guide plotted the latest weight on today's band however
// old it was, so a baby weighed at P50 a month ago sat near P3.

beforeEach(() => {
  window.localStorage.clear();
  stubBrowser();
  Element.prototype.scrollTo = () => {};
});
afterEach(() => cleanup());

test("fractional age counts days, not completed months", () => {
  const now = new Date(2026, 9, 14, 12, 0).getTime();
  expect(exactAgeInMonths("2026-09-18", now)).toBeCloseTo(0.85, 2);
  expect(exactAgeInMonths("not a date", now)).toBeNull();
  expect(exactAgeInMonths("2026-09-18", Number.NaN)).toBeNull();
});

test("the summary for the paediatrician quotes the band for a 26-day-old, not for birth", () => {
  const now = new Date(2026, 9, 14, 12, 0).getTime();
  const profile: Profile = { name: "Mia", birthDate: "2026-09-18", feedingMode: "bottle", sex: "girl" };
  const log: Activity[] = [
    { id: "g", type: "growth", startedAt: new Date(now - 3_600_000).toISOString(), weightGrams: 4200 },
    { id: "b", type: "bottle", startedAt: new Date(now - 7_200_000).toISOString(), amount: 90, milkType: "formula" },
  ];
  render(
    <VisitSummarySheet
      open
      onOpenChange={() => {}}
      summary={buildVisitSummary(log, now, 14)}
      profile={profile}
      ageMonths={0}
      now={now}
    />,
  );
  const text = document.body.textContent ?? "";
  expect(text).toContain("WHO reference at this age: 3.1 kg–5.2 kg (P3–P97), midpoint 4.1 kg.");
  expect(text).not.toContain("2.4 kg–4.2 kg");
});

function guide(weighedOn: Date, weightGrams: number) {
  const profile: Profile = { name: "Mia", birthDate: "2026-07-15", feedingMode: "mixed", sex: "girl" };
  const latestGrowth: Activity = { id: "g", type: "growth", startedAt: weighedOn.toISOString(), weightGrams };
  render(<GrowthGuideScreen profile={profile} latestGrowth={latestGrowth} minuteClock={new Date(2026, 9, 15, 12, 0).getTime()} />);
  const left = (selector: string) => parseFloat(document.querySelector<HTMLElement>(selector)!.style.left);
  return { marker: left(".range-marker"), median: left(".range-median") };
}

test("a weight logged at P50 a month ago sits on today's P50 line", () => {
  // 5.1 kg is WHO girls' median at 2 months; on 15 Oct she is 3 months.
  const { marker, median } = guide(new Date(2026, 8, 15, 12, 0), 5_100);
  expect(marker).toBeCloseTo(median, 5);
  expect(document.body.textContent).toContain("Mia’s latest: 5.1 kg (Sep 15)");
  expect(document.body.textContent).toContain("The dot shows where that weight sat for Mia’s age on the day it was taken.");
});

test("a weight logged today is placed exactly where it is", () => {
  const { marker, median } = guide(new Date(2026, 9, 15, 9, 0), 5_800);
  expect(marker).toBeCloseTo(median, 5);
  expect(document.body.textContent).not.toContain("The dot shows where");
});
