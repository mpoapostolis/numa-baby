/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { DayRecap } from "@/components/DayRecap";
import TimelineScreen from "@/screens/TimelineScreen";
import { detailReadsClock } from "@/domain/activityDisplay";
import { summarizeDay } from "@/domain/daySummary";
import { FEED_BOUNDS } from "@/domain/forecast";
import { rhythmLine, rhythmRecord, stepsFromMoments } from "@/domain/rhythm";
import { Activity } from "@/domain/types";
import { seedLog, stubBrowser } from "./appHarness";

// The figures on Today have to say what happened — a parent acts on them.

// 15 Oct 2026, 15:00 local. Only Date is faked: React and the app's own
// intervals keep running on real timers.
const NOW = new Date(2026, 9, 15, 15, 0).getTime();
const MINUTE = 60_000;
const at = (minutesFromNow: number) => new Date(NOW + minutesFromNow * MINUTE).toISOString();

beforeEach(() => {
  stubBrowser();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const nursed: Activity = { id: "n", type: "nursing", side: "left", startedAt: at(-120), endedAt: at(-100) };

describe("the Nursed tile", () => {
  it.each(["sleep", "tummy", "burp"] as const)("does not call a running %s timer a nursing still going", (type) => {
    const summary = summarizeDay([nursed, { id: "t", type, startedAt: at(-10) }], new Date(NOW), NOW);
    expect(summary.hasRunningNursing).toBe(false);
    render(<DayRecap summary={summary} title="Today so far" />);
    expect(screen.getByText("1 session")).toBeTruthy();
    expect(document.body.textContent).not.toContain("still going");
  });

  it("still says so when a nursing is running", () => {
    const summary = summarizeDay([nursed, { id: "o", type: "nursing", side: "right", startedAt: at(-5) }], new Date(NOW), NOW);
    expect(summary.hasRunningNursing).toBe(true);
    render(<DayRecap summary={summary} title="Today so far" />);
    expect(screen.getByText("2 sessions · one still going")).toBeTruthy();
  });
});

describe("the recap's empty line", () => {
  it("does not say nothing was logged when only a medicine was", () => {
    const summary = summarizeDay([{ id: "m", type: "medicine", medicine: "Vitamin D", startedAt: at(-60) }], new Date(NOW), NOW);
    expect(summary.isEmpty).toBe(true);
    render(<DayRecap summary={summary} title="Today so far" />);
    expect(screen.getByText("No feeds, changes or sleep logged yet today.")).toBeTruthy();
    expect(screen.queryByText("Nothing logged yet today.")).toBeNull();
  });

  it("still says nothing on a day with nothing", () => {
    render(<DayRecap summary={summarizeDay([], new Date(NOW), NOW)} title="Today so far" />);
    expect(screen.getByText("Nothing logged yet today.")).toBeTruthy();
  });
});

describe("Since last feed", () => {
  async function hearthMeta() {
    return waitFor(() => {
      const meta = document.querySelector(".hearth-meta");
      if (!meta) throw new Error("not on Today yet");
      return meta.textContent;
    }, { timeout: 5_000 });
  }

  it("names a both-sides nursing as both sides", async () => {
    seedLog([{ id: "b", type: "nursing", side: "both", startedAt: at(-60), endedAt: at(-40) }]);
    render(<App />);
    expect(await hearthMeta()).toBe("Nursing · both sides · 20m");
  }, 15_000);

  it("names no side for a nursing saved without one", async () => {
    seedLog([{ id: "s", type: "nursing", startedAt: at(-60), endedAt: at(-40) }]);
    render(<App />);
    expect(await hearthMeta()).toBe("Nursing · 20m");
  }, 15_000);
});

it("the recap arrows reach a first entry made late last night", async () => {
  // Yesterday 23:59 is fifteen hours ago — under a full day, but a calendar
  // day back all the same.
  const lastNight = new Date(2026, 9, 14, 23, 59).toISOString();
  seedLog([
    { id: "y", type: "bottle", amount: 90, startedAt: lastNight },
    { id: "t", type: "bottle", amount: 90, startedAt: at(-60) },
  ]);
  render(<App />);
  const previous = await waitFor(() => {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Previous day"]');
    if (!button) throw new Error("no arrow back");
    return button;
  }, { timeout: 5_000 });
  expect(previous.disabled).toBe(false);
  await act(async () => fireEvent.click(previous));
  expect(document.querySelector('[aria-label="Yesterday summary"]')).toBeTruthy();
  expect(previous.disabled).toBe(true);
}, 15_000);

it("adds up short tummy-time goes before rounding them", async () => {
  // Three 25-second goes: 75 seconds, a minute — not three times nothing.
  seedLog([0, 1, 2].map((index) => ({
    id: `t${index}`,
    type: "tummy" as const,
    startedAt: at(-60 + index * 10),
    endedAt: new Date(NOW + (-60 + index * 10) * MINUTE + 25_000).toISOString(),
  })));
  render(<App />);
  const row = await waitFor(() => {
    const found = Array.from(document.querySelectorAll("button")).find((b) => /^Tummy time/.test(b.textContent ?? ""));
    if (!found) throw new Error("not on Today yet");
    return found;
  }, { timeout: 5_000 });
  expect(row.textContent).toContain("1m today");
}, 15_000);

describe("a running timer's row", () => {
  const running: Activity = { id: "r", type: "tummy", startedAt: at(-2) };

  it("moves with the minute clock in the Timeline", () => {
    const props = { filter: "all" as const, limit: 50, onFilterChange: () => {}, onShowMore: () => {}, onEdit: () => {} };
    const view = render(<TimelineScreen activities={[running]} minuteClock={NOW + 43 * MINUTE} {...props} />);
    expect(screen.getByRole("listitem").textContent).toContain("45m ago");
    view.rerender(<TimelineScreen activities={[running]} minuteClock={NOW + 53 * MINUTE} {...props} />);
    expect(screen.getByRole("listitem").textContent).toContain("55m ago");
  });

  it("moves with the minute clock in Recent", async () => {
    seedLog([{ id: "s", type: "sleep", startedAt: at(-2) }]);
    render(<App />);
    const recent = () => document.querySelector(".recent-list")?.textContent ?? "";
    await waitFor(() => expect(recent()).toContain("2m ago"), { timeout: 5_000 });
    // The app's minute clock re-reads the time whenever the page comes back.
    vi.setSystemTime(NOW + 43 * MINUTE);
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(recent()).toContain("45m ago");
  }, 15_000);

  it("is the only kind handed the clock", () => {
    expect(detailReadsClock(running)).toBe(true);
    expect(detailReadsClock({ ...running, endedAt: at(0) })).toBe(false);
    // A bottle has no end time, but nothing on its row moves.
    expect(detailReadsClock({ id: "b", type: "bottle", amount: 90, startedAt: at(-30) })).toBe(false);
  });
});

it("does not score a top-up bottle as a missed forecast", () => {
  // Clockwork three-hourly feeds, each nursing topped up by a bottle ten
  // minutes later. The forecast ignores the ten-minute gaps; so must its score.
  const moments: number[] = [];
  for (let feed = 0; feed < 10; feed += 1) {
    moments.push(NOW + feed * 180 * MINUTE, NOW + (feed * 180 + 10) * MINUTE);
  }
  const record = rhythmRecord("feed", stepsFromMoments(moments), FEED_BOUNDS);
  expect(record.checked).toBeGreaterThan(0);
  expect(record.hits).toBe(record.checked);
  expect(rhythmLine(record, "Mia")).toMatch(/^Right every one/);
});
