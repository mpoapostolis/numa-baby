/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import App from "@/App";
import { summarizeDay } from "@/domain/daySummary";
import { nursingSideAverage } from "@/domain/nursingSides";
import { Activity } from "@/domain/types";
import { seedLog, stubBrowser } from "./appHarness";

// From the feedback box: "a statistic of how long she nurses on the right
// and on the left each day … or in Insights". The usual day, by side.

const now = Date.parse("2026-08-14T20:00:00");
const nursing = (id: string, day: number, side: Activity["side"], from: string, minutes: number): Activity => {
  const start = new Date(`2026-08-${String(day).padStart(2, "0")}T${from}:00`);
  return { id, type: "nursing", side, startedAt: start.toISOString(), endedAt: new Date(start.getTime() + minutes * 60_000).toISOString() };
};
const week = (activities: Activity[]) =>
  [8, 9, 10, 11, 12, 13, 14].map((day) => summarizeDay(activities, new Date(2026, 7, day), now));

describe("the week's nursing, by side", () => {
  it("averages each side over the days that had nursing, leaving today out", () => {
    const log = [
      nursing("a", 12, "left", "06:00", 40), nursing("b", 12, "right", "07:00", 30),
      nursing("c", 13, "left", "06:00", 50), nursing("d", 13, "right", "07:00", 20),
      // Today, half lived: not averaged in while complete days exist.
      nursing("e", 14, "left", "06:00", 5),
    ];
    expect(nursingSideAverage(week(log))).toEqual({ left: 45, right: 25, both: 0, days: 2 });
  });

  it("does not count a bottles-only day as a day of zero nursing", () => {
    const log: Activity[] = [
      nursing("a", 12, "left", "06:00", 30),
      { id: "b", type: "bottle", startedAt: new Date("2026-08-13T06:00:00").toISOString(), amount: 90 },
    ];
    expect(nursingSideAverage(week(log))).toEqual({ left: 30, right: 0, both: 0, days: 1 });
  });

  it("uses today when it is the only day with nursing", () => {
    expect(nursingSideAverage(week([nursing("a", 14, "right", "06:00", 12)]))).toEqual({ left: 0, right: 12, both: 0, days: 1 });
  });

  it("keeps both-sides sessions apart, and has nothing to say without nursing", () => {
    expect(nursingSideAverage(week([nursing("a", 12, "both", "06:00", 20), nursing("b", 12, "left", "08:00", 10)])))
      .toEqual({ left: 10, right: 0, both: 20, days: 1 });
    expect(nursingSideAverage(week([]))).toBeNull();
  });
});

describe("on Insights", () => {
  beforeEach(() => {
    stubBrowser();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function openInsights() {
    render(<App />);
    // The bottom bar and the sidebar both carry it; either opens the screen.
    (await screen.findAllByRole("button", { name: "Insights" }, { timeout: 5_000 }))[0].click();
  }

  test("the card says the usual day on each side", async () => {
    seedLog([
      nursing("a", 12, "left", "06:00", 40), nursing("b", 12, "right", "07:00", 30),
      nursing("c", 13, "left", "06:00", 50), nursing("d", 13, "right", "07:00", 20), nursing("e", 13, "both", "09:00", 10),
    ]);
    await openInsights();
    expect(await screen.findByText("About 45m on the left and 25m on the right a day.", undefined, { timeout: 5_000 })).toBeTruthy();
    expect(screen.getByText(/An average of the 2 days with nursing this week\. Sessions on both sides add 5m a day/)).toBeTruthy();
  }, 15_000);

  test("a bottle-only family never sees it", async () => {
    seedLog([{ id: "b", type: "bottle", startedAt: new Date("2026-08-13T06:00:00").toISOString(), amount: 90 }]);
    await openInsights();
    await screen.findByText("Feeds / day", undefined, { timeout: 5_000 });
    expect(screen.queryByText("Nursing by side")).toBeNull();
  }, 15_000);
});
