/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { TrendChart } from "@/components/TrendChart";
import { summarizeDays } from "@/domain/daySummary";
import { Activity } from "@/domain/types";

// Asked for from the feedback box, the day after the chart reached Insights:
// "Are we able to click on each day? The only thing that can be seen is the
// average sleep. Would be great if we can hover on to each day and shows
// the total for each day." Each bar carried a title tooltip — which a mouse
// can summon and a phone never shows.

const NOW = new Date(2026, 9, 14, 15, 0).getTime();

function sleep(id: string, day: number, fromHour: number, hours: number): Activity {
  const start = new Date(2026, 9, day, fromHour, 0);
  return {
    id,
    type: "sleep",
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + hours * 3_600_000).toISOString(),
  };
}

const days = summarizeDays(
  [sleep("a", 12, 9, 3), sleep("b", 13, 8, 5), sleep("c", 14, 10, 2)],
  new Date(NOW),
  3,
  NOW,
);

function readout() {
  return document.querySelector(".trend-average")!.textContent ?? "";
}

beforeEach(() => {
  window.localStorage.clear();
  render(<TrendChart days={days} />);
  fireEvent.click(screen.getByRole("button", { name: "Sleep" }));
});

afterEach(() => cleanup());

test("tapping a day shows that day's total instead of the average", () => {
  expect(readout()).toContain("a day on average");

  fireEvent.click(screen.getByRole("button", { name: /Oct 13/ }));
  expect(readout()).toContain("5h");
  expect(readout()).toContain("Oct 13");
  expect(readout()).not.toContain("average");
});

test("tapping the same day again goes back to the average", () => {
  const day = screen.getByRole("button", { name: /Oct 13/ });
  fireEvent.click(day);
  fireEvent.click(day);
  expect(readout()).toContain("a day on average");
});

test("today says it is not over yet", () => {
  fireEvent.click(screen.getByRole("button", { name: /Oct 14/ }));
  expect(readout()).toContain("2h");
  expect(readout()).toContain("so far today");
});

test("a mouse only has to hover", () => {
  const day = screen.getByRole("button", { name: /Oct 12/ });
  fireEvent.pointerEnter(day, { pointerType: "mouse" });
  expect(readout()).toContain("3h");
  fireEvent.pointerLeave(day, { pointerType: "mouse" });
  expect(readout()).toContain("a day on average");
});

test("the day stays chosen when the category changes", () => {
  fireEvent.click(screen.getByRole("button", { name: /Oct 13/ }));
  fireEvent.click(screen.getByRole("button", { name: "Wet" }));
  expect(readout()).toContain("Oct 13");
});
