/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import App from "@/App";
import { summarizeDays } from "@/domain/daySummary";
import { averageDay, groupDays, rangeDayCount } from "@/domain/insightRange";
import { Activity } from "@/domain/types";
import { seedLog, stubBrowser } from "./appHarness";

// From the feedback box: "For the Insights, please have the option of
// customizing it, like if we only want to see 7 days, 5 days, 1 month,
// year, etc."

const now = Date.parse("2026-08-14T20:00:00");

describe("the ranges", () => {
  it("covers a week, thirty days, thirteen weeks, and twelve calendar months", () => {
    expect(rangeDayCount("7d", now)).toBe(7);
    expect(rangeDayCount("30d", now)).toBe(30);
    expect(rangeDayCount("3m", now)).toBe(91);
    // 1 September 2025 to 14 August 2026, both ends included.
    expect(rangeDayCount("1y", now)).toBe(348);
  });

  it("draws weeks back from today, and months by the calendar", () => {
    const days = summarizeDays([], new Date(now), 91, now);
    const weeks = groupDays(days, "week");
    expect(weeks).toHaveLength(13);
    expect(weeks.every((week) => week.days.length === 7)).toBe(true);
    expect(weeks[12].days[6].isToday).toBe(true);
    // A record that starts mid-week: the first week has the days it has.
    expect(groupDays(days.slice(-10), "week").map((week) => week.days.length)).toEqual([3, 7]);

    const months = groupDays(summarizeDays([], new Date(now), rangeDayCount("1y", now), now), "month");
    expect(months).toHaveLength(12);
    expect(months[0].days[0].date.getDate()).toBe(1);
    expect(months[0].days).toHaveLength(30); // September
    expect(months[11].days).toHaveLength(14); // August, to today
  });

  it("averages the logged days, leaving today out while complete days exist", () => {
    const log: Activity[] = [
      { id: "a", type: "bottle", amount: 100, startedAt: new Date("2026-08-12T08:00:00").toISOString() },
      { id: "b", type: "bottle", amount: 100, startedAt: new Date("2026-08-12T12:00:00").toISOString() },
      { id: "c", type: "bottle", amount: 100, startedAt: new Date("2026-08-13T08:00:00").toISOString() },
      { id: "d", type: "bottle", amount: 100, startedAt: new Date("2026-08-14T08:00:00").toISOString() },
    ];
    // 11 August had nothing logged: not a day of zero feeds.
    const days = summarizeDays(log, new Date(now), 4, now);
    expect(averageDay(days, (day) => day.feeds)).toBe(1.5);
    expect(averageDay(summarizeDays([], new Date(now), 4, now), (day) => day.feeds)).toBeNull();
  });
});

describe("on Insights", () => {
  // Two bottles of 100 ml a day from 1 July, four a day from 8 August.
  function seedSummer() {
    const log: Activity[] = [];
    for (let date = new Date(2026, 6, 1, 8); date.getTime() < now; date.setDate(date.getDate() + 1)) {
      const feeds = date >= new Date(2026, 7, 8) ? 4 : 2;
      for (let feed = 0; feed < feeds; feed++) {
        const at = new Date(date);
        at.setHours(8 + feed * 3);
        if (at.getTime() < now) log.push({ id: `${at.getTime()}`, type: "bottle", amount: 100, milkType: "formula", startedAt: at.toISOString() });
      }
    }
    seedLog(log);
  }

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
    (await screen.findAllByRole("button", { name: "Insights" }, { timeout: 5_000 }))[0].click();
    await screen.findByRole("radio", { name: "7 days" }, { timeout: 5_000 });
  }
  const feedsPerDay = () => screen.getByText("Feeds / day").parentElement!.querySelector("strong")!.textContent;

  test("the week is the default, and its figures are the ones it always had", async () => {
    seedSummer();
    await openInsights();
    expect(screen.getByRole("radio", { name: "7 days" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Last 7 days", { selector: ".eyebrow" })).toBeTruthy();
    expect(feedsPerDay()).toBe("4.0");
  }, 15_000);

  test("thirty days re-reads the same log, and the phone remembers the choice", async () => {
    seedSummer();
    await openInsights();
    fireEvent.click(screen.getByRole("radio", { name: "30 days" }));
    expect(screen.getByText("Last 30 days", { selector: ".eyebrow" })).toBeTruthy();
    // 16 July to 13 August: 23 days of two feeds and six of four.
    expect(feedsPerDay()).toBe("2.4");
    expect(window.localStorage.getItem("numalog-insights-range-v1")).toBe("30d");
    await waitFor(() => expect(screen.getAllByText("Most bottle days total about 200 ml.").length).toBeGreaterThan(0));
    cleanup();

    render(<App />);
    (await screen.findAllByRole("button", { name: "Insights" }, { timeout: 5_000 }))[0].click();
    expect((await screen.findByRole("radio", { name: "30 days" }, { timeout: 5_000 })).getAttribute("aria-checked")).toBe("true");
  }, 20_000);

  test("a year is drawn by month, each bar the month's average day", async () => {
    seedSummer();
    await openInsights();
    fireEvent.click(screen.getByRole("radio", { name: "Year" }));
    expect(screen.getByText("Last 12 months", { selector: ".eyebrow" })).toBeTruthy();
    expect(screen.getByText(/Each bar is the average bottle day\./)).toBeTruthy();
    // The record starts in July: no empty months before it.
    const july = screen.getByRole("button", { name: "July: 200 ml" });
    expect(screen.queryByRole("button", { name: /^June/ })).toBeNull();
    fireEvent.click(july);
    expect(screen.getByText(/a day · July/)).toBeTruthy();
    // August so far: seven days of 200 ml and six of 400 — today left out.
    expect(screen.getByRole("button", { name: "August: 292 ml" })).toBeTruthy();
  }, 15_000);
});
