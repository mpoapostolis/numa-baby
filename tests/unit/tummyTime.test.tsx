/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import TimelineScreen from "@/screens/TimelineScreen";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import { activityDetail, activityTitle } from "@/domain/activityDisplay";
import { seedLog, stubBrowser } from "./appHarness";

// Asked for from the feedback box: "I don't understand the use of the
// burping timer, but I am using it to time the tummy time, it would be a
// useful separate timer I think."

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  stubBrowser();
});

async function tummyRow() {
  return waitFor(() => {
    const found = Array.from(document.querySelectorAll("button")).find((b) => /^Tummy time/.test(b.textContent ?? ""));
    if (!found) throw new Error("not on Today yet");
    return found;
  }, { timeout: 5_000 });
}

const stored = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).activities as Array<{ type: string; endedAt?: string }>;

test("Today has its own tummy time timer: one tap starts it, Done stops it", async () => {
  seedLog([{ id: "b", type: "bottle", amount: 120, startedAt: new Date(Date.now() - 3_600_000).toISOString() }]);
  render(<App />);
  const row = await tummyRow();
  await act(async () => fireEvent.click(row));
  expect(stored().filter((a) => a.type === "tummy" && !a.endedAt)).toHaveLength(1);

  const done = await screen.findByRole("button", { name: "Done — stop tummy time timer" });
  await act(async () => fireEvent.click(done));
  expect(stored().filter((a) => a.type === "tummy" && a.endedAt)).toHaveLength(1);
}, 15_000);

test("the row says how much tummy time there has been today", async () => {
  const start = new Date();
  start.setMinutes(start.getMinutes() - 30);
  const end = new Date(start.getTime() + 12 * 60_000);
  seedLog([{ id: "t1", type: "tummy", startedAt: start.toISOString(), endedAt: end.toISOString() }]);
  render(<App />);
  expect((await tummyRow()).textContent).toContain("12m today");
}, 15_000);

test("in the log it is called tummy time, and has a filter of its own", () => {
  const entry = { id: "t", type: "tummy" as const, startedAt: "2026-10-15T09:00:00.000Z", endedAt: "2026-10-15T09:08:00.000Z" };
  expect(activityTitle(entry)).toBe("Tummy time");
  expect(activityDetail(entry)).toContain("8m");
  render(<TimelineScreen activities={[entry]} minuteClock={Date.now()} filter="tummy" limit={50} onFilterChange={() => {}} onShowMore={() => {}} onEdit={() => {}} />);
  expect(screen.getByRole("radio", { name: "Show tummy time logs" }).textContent).toBe("Tummy time");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});
