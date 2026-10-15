/** @vitest-environment jsdom */
import { cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { TrendChart } from "@/components/TrendChart";
import { summarizeDays } from "@/domain/daySummary";
import { Activity, Profile } from "@/domain/types";
import { useActivityStats } from "@/hooks/useActivityStats";
import InsightsScreen from "@/screens/InsightsScreen";
import { stubBrowser } from "./appHarness";

// Three ways the Insights averages read low. "Feeds / day" divided by the
// calendar days since the oldest entry of any kind, so a backdated birth
// weight spread a fortnight of feeds over a month. Every average counted
// today's half-lived morning as a whole day, so on day two "most bottle days"
// were half of the only full one. And a day holding nothing but a weigh-in
// counted as a logged zero-milk day.

const profile: Profile = { name: "Mia", birthDate: "2026-09-01", feedingMode: "bottle" };

function at(daysAgo: number, hour: number, minute = 0): string {
  const date = new Date(2026, 9, 14, hour, minute);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function bottles(daysAgo: number, count: number, ml: number, fromHour = 0): Activity[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `b-${daysAgo}-${index}`,
    type: "bottle" as const,
    startedAt: at(daysAgo, fromHour + index * 2),
    amount: ml,
    milkType: "formula" as const,
  }));
}

function readout() {
  return document.querySelector(".trend-average")!.textContent ?? "";
}

beforeEach(() => {
  window.localStorage.clear();
  stubBrowser();
});
afterEach(() => cleanup());

test("a backdated birth weight does not stretch Feeds / day over days nobody logged", () => {
  const now = new Date(2026, 9, 14, 9, 0).getTime();
  const log: Activity[] = [
    { id: "birth", type: "growth", startedAt: at(43, 12), weightGrams: 3300 },
    ...bottles(2, 8, 100),
    ...bottles(1, 8, 100),
  ];
  const { result } = renderHook(() => useActivityStats(log, profile, now));
  expect(result.current.averageFeeds).toBe(8);
});

test("a week off between logs does not count as days without feeds", () => {
  const now = new Date(2026, 9, 14, 9, 0).getTime();
  const log = [...bottles(6, 8, 100), ...bottles(2, 8, 100), ...bottles(1, 8, 100)];
  const { result } = renderHook(() => useActivityStats(log, profile, now));
  expect(result.current.averageFeeds).toBe(8);
});

test("on day one, today's feeds are the average rather than a dash", () => {
  const now = new Date(2026, 9, 14, 9, 0).getTime();
  const { result } = renderHook(() => useActivityStats(bottles(0, 3, 100), profile, now));
  expect(result.current.averageFeeds).toBe(3);
});

test("on day two, this morning does not count as a whole day", () => {
  // Yesterday 8 × 100 ml; today two bottles by 07:30.
  const now = new Date(2026, 9, 14, 7, 30).getTime();
  const log = [...bottles(1, 8, 100, 6), ...bottles(0, 2, 100, 5)];
  const { result } = renderHook(() => useActivityStats(log, profile, now));
  expect(result.current.averageFeeds).toBe(8);

  render(
    <InsightsScreen
      stats={result.current}
      activities={log}
      profile={profile}
      ageDays={43}
      feedingMode="bottle"
      minuteClock={now}
      onAddGrowth={() => {}}
      onOpenGuide={() => {}}
    />,
  );
  const tiles = document.querySelector(".insight-summary")!.textContent ?? "";
  expect(tiles).toContain("8.0Feeds / day");
  expect(document.querySelector(".insight-figure h2")!.textContent).toBe("Most bottle days total about 800 ml.");
  expect(readout()).toContain("800");
  expect(readout()).toContain("a day on average");
});

test("the trend average ignores today, and a weigh-in alone is not a logged day", () => {
  // Three days of 5 × 150 ml (today's done by 23:00, but still today), and a
  // clinic weigh-in five days ago with nothing else logged.
  const now = new Date(2026, 9, 14, 23, 0).getTime();
  const log: Activity[] = [
    { id: "clinic", type: "growth", startedAt: at(5, 10), weightGrams: 4200 },
    ...bottles(2, 5, 150, 8),
    ...bottles(1, 5, 150, 8),
    ...bottles(0, 5, 150, 8),
  ];
  render(<TrendChart days={summarizeDays(log, new Date(now), 14, now)} />);
  expect(readout()).toContain("750");
  expect(readout()).toContain("a day on average");
  expect(document.querySelector(".trend-card .t-label")!.textContent).toBe("Last 3 days");
});

test("a weigh-in day inside the chart is drawn as not logged, not as a zero", () => {
  const now = new Date(2026, 9, 14, 23, 0).getTime();
  const log: Activity[] = [
    ...bottles(3, 5, 150, 8),
    { id: "clinic", type: "growth", startedAt: at(2, 10), weightGrams: 4200 },
    ...bottles(1, 5, 150, 8),
    ...bottles(0, 5, 150, 8),
  ];
  render(<TrendChart days={summarizeDays(log, new Date(now), 14, now)} />);
  expect(readout()).toContain("750");
  const weighIn = document.querySelector<HTMLButtonElement>('button[aria-label^="Oct 12"]')!;
  expect(weighIn.getAttribute("aria-label")).toBe("Oct 12: not logged");
  expect(weighIn.querySelector(".trend-fill")).toBeNull();
});
