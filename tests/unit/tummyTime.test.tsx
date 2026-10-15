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

/** A baby this many days old today, for the seeded profile. */
function bornDaysAgo(days: number) {
  const birth = new Date();
  birth.setDate(birth.getDate() - days);
  const iso = `${birth.getFullYear()}-${String(birth.getMonth() + 1).padStart(2, "0")}-${String(birth.getDate()).padStart(2, "0")}`;
  const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
  saved.profile.birthDate = iso;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function goneFor(minutes: number) {
  // Ended a minute ago, so it is today whatever the hour the suite runs at
  // — unless that is the first minutes after midnight, when it was yesterday.
  const end = new Date(Date.now() - 60_000);
  const start = new Date(end.getTime() - minutes * 60_000);
  return { id: `t${minutes}`, type: "tummy" as const, startedAt: start.toISOString(), endedAt: end.toISOString() };
}

const fitsToday = (minutes: number) => new Date(Date.now() - (minutes + 1) * 60_000).getDate() === new Date().getDate();

// "You know you didn't do tummy time today — how much is left?"
test("the row says how much is left of today's tummy time", async () => {
  if (!fitsToday(12)) return;
  seedLog([goneFor(12)]);
  bornDaysAgo(80);
  render(<App />);
  expect((await tummyRow()).textContent).toContain("12m of 30m today · 18m to go");
}, 15_000);

test("a day with none yet says so, with the goal for this age", async () => {
  seedLog([]);
  bornDaysAgo(20);
  render(<App />);
  const row = await tummyRow();
  expect(row.textContent).toContain("None yet today · aim for 10m, awake and watched");
  expect(row.querySelector("small.tummy-none")).not.toBeNull();
}, 15_000);

// Judged on the seconds: a 20-second go is not "none", and 29m 30s of a
// 30-minute goal is not done.
test("progress is judged on the seconds, not the rounded minutes", async () => {
  const end = new Date(Date.now() - 60_000);
  const goes = [
    { id: "short", type: "tummy" as const, startedAt: new Date(end.getTime() - 20_000).toISOString(), endedAt: end.toISOString() },
  ];
  if (new Date(end.getTime() - 20_000).getDate() !== new Date().getDate()) return;
  seedLog(goes);
  bornDaysAgo(80);
  render(<App />);
  expect((await tummyRow()).textContent).toContain("<1m of 30m today · 30m to go");
  cleanup();

  const long = new Date(end.getTime() - (29 * 60 + 30) * 1_000);
  if (long.getDate() !== new Date().getDate()) return;
  seedLog([{ id: "long", type: "tummy", startedAt: long.toISOString(), endedAt: end.toISOString() }]);
  bornDaysAgo(80);
  render(<App />);
  expect((await tummyRow()).textContent).toContain("29m of 30m today · 1m to go");
}, 20_000);

test("a goal met says so", async () => {
  if (!fitsToday(35)) return;
  seedLog([goneFor(35)]);
  bornDaysAgo(80);
  render(<App />);
  expect((await tummyRow()).textContent).toContain("35m today · today’s 30m done");
}, 15_000);

// Rolling both ways by about 7 months: floor time, not a timer to fill.
test("past about seven months there is no goal, only the total", async () => {
  if (!fitsToday(12)) return;
  seedLog([goneFor(12)]);
  bornDaysAgo(240);
  render(<App />);
  const text = (await tummyRow()).textContent;
  expect(text).toContain("12m today · start the timer");
  expect(text).not.toContain("to go");
}, 15_000);

test("in the log it is called tummy time, and has a filter of its own", () => {
  const entry = { id: "t", type: "tummy" as const, startedAt: "2026-10-15T09:00:00.000Z", endedAt: "2026-10-15T09:08:00.000Z" };
  expect(activityTitle(entry)).toBe("Tummy time");
  expect(activityDetail(entry)).toContain("8m");
  render(<TimelineScreen activities={[entry]} minuteClock={Date.now()} filter="tummy" limit={50} onFilterChange={() => {}} onShowMore={() => {}} onEdit={() => {}} />);
  expect(screen.getByRole("radio", { name: "Show tummy time logs" }).textContent).toBe("Tummy time");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});
