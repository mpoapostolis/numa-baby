/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Activity, Profile } from "@/domain/types";
import { useActivityStats } from "@/hooks/useActivityStats";
import InsightsScreen from "@/screens/InsightsScreen";
import { stubBrowser } from "./appHarness";

// From the feedback box: "Could you add a statistic with the number of
// diapers we have used a day, a week, a month?"

const profile: Profile = { name: "Mia", birthDate: "2026-08-01", feedingMode: "bottle" };
const now = new Date(2026, 9, 14, 20, 0).getTime();

function diapers(daysAgo: number, count: number, kind: Activity["diaperKind"] = "wet"): Activity[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `d-${daysAgo}-${index}`,
    type: "diaper" as const,
    diaperKind: kind,
    startedAt: new Date(2026, 9, 14 - daysAgo, 6 + index).toISOString(),
  }));
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderInsights(log: Activity[]) {
  stubBrowser();
  window.localStorage.clear();
  const { result } = renderHook(() => useActivityStats(log, profile, now));
  render(
    <InsightsScreen
      stats={result.current}
      activities={log}
      profile={profile}
      ageDays={74}
      feedingMode="bottle"
      minuteClock={now}
      onAddGrowth={() => {}}
      onOpenGuide={() => {}}
      onSaveProfile={() => true}
    />,
  );
}

const figure = (label: string) =>
  [...document.querySelectorAll(".diaper-figures > div")].find((item) => item.querySelector("dt")!.textContent === label)!.querySelector("dd")!.textContent;

test("the week's diapers in all, and the usual day, week and month", () => {
  // Six days of 6, one wet-and-dirty among them each day — one diaper, not
  // two — and 3 so far today, which is not a whole day.
  const log = [1, 2, 3, 4, 5, 6].flatMap((day) => [...diapers(day, 5), { ...diapers(day, 6)[5], diaperKind: "both" as const }]).concat(diapers(0, 3));
  renderInsights(log);
  expect(screen.getByText("About 6 a day.")).toBeTruthy();
  expect(figure("Last 7 days")).toBe("39");
  expect(figure("A day")).toBe("6");
  expect(figure("A week")).toBe("42");
  expect(figure("A month")).toBe("180");
});

test("the count follows the range", () => {
  const log = Array.from({ length: 40 }, (_, day) => diapers(day + 1, 7)).flat();
  renderInsights(log);
  fireEvent.click(screen.getByRole("radio", { name: "30 days" }));
  // 15 September to today: 29 whole days of 7, and nothing yet today.
  expect(figure("Last 30 days")).toBe("203");
  expect(figure("A day")).toBe("7");
});

test("a family that logs no diapers never sees the card", () => {
  renderInsights([{ id: "b", type: "bottle", amount: 120, startedAt: new Date(2026, 9, 13, 8).toISOString() }]);
  expect(document.querySelector(".diaper-card")).toBeNull();
});
