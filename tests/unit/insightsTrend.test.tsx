/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import { Activity } from "@/domain/types";
import { seedLog, stubBrowser } from "./appHarness";

// Asked for from the feedback box: "I'd like to be able to add which category
// I want to track in the insights page, for example, sleep to see the
// variations of sleeping times." The day-by-day chart with that choice lived
// only on Today; Insights, where a parent goes to look at a pattern, had no
// sleep anywhere.

const HOUR = 3_600_000;

function sleepsOverTwoDays(): Activity[] {
  const now = Date.now();
  return [
    { id: "a", type: "sleep", startedAt: new Date(now - 30 * HOUR).toISOString(), endedAt: new Date(now - 27 * HOUR).toISOString() },
    { id: "b", type: "sleep", startedAt: new Date(now - 5 * HOUR).toISOString(), endedAt: new Date(now - 3 * HOUR).toISOString() },
    { id: "c", type: "diaper", diaperKind: "wet", startedAt: new Date(now - 2 * HOUR).toISOString() },
  ];
}

async function openInsights() {
  // Role queries over the whole app are slow in jsdom; wait for the shell by
  // a cheap selector first.
  const tab = await waitFor(() => {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Insights"]');
    if (!button) throw new Error("no Insights tab yet");
    return button;
  }, { timeout: 5_000 });
  await act(async () => {
    fireEvent.click(tab);
  });
  return waitFor(() => {
    const heading = document.getElementById("insights-heading");
    if (!heading) throw new Error("Insights not open yet");
    return heading;
  }, { timeout: 5_000 });
}

beforeEach(() => {
  seedLog(sleepsOverTwoDays());
  stubBrowser();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("insights can chart sleep, day by day", async () => {
  render(<App />);
  const heading = await openInsights();
  const insights = heading.closest("section")!;

  const choices = insights.querySelector('[aria-label="Choose what to chart"]');
  expect(choices).not.toBeNull();
  fireEvent.click(Array.from(choices!.querySelectorAll("button")).find((b) => b.textContent === "Sleep")!);

  expect(insights.querySelector('[aria-label^="Sleep over the last"]')).not.toBeNull();
});

test("the category picked is the one shown next time", async () => {
  const first = render(<App />);
  let insights = (await openInsights()).closest("section")!;
  fireEvent.click(Array.from(insights.querySelectorAll('[aria-label="Choose what to chart"] button')).find((b) => b.textContent === "Sleep")!);
  first.unmount();

  render(<App />);
  insights = (await openInsights()).closest("section")!;
  const sleep = Array.from(insights.querySelectorAll('[aria-label="Choose what to chart"] button')).find((b) => b.textContent === "Sleep")!;
  expect(sleep.getAttribute("aria-pressed")).toBe("true");
});
