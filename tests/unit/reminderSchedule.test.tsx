/** @vitest-environment jsdom */
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import type { Schedule } from "@/domain/pushClient";
import type { ReminderSettings } from "@/domain/types";
import { stubBrowser } from "./appHarness";

// What the app tells the push server when one reminder is already overdue.
// With both on and a two-hour nappy interval that is most of the time, and
// the overdue time went along with every update — which the server refuses,
// whole. worker/push.ts's tests cover the server's half.

const push = vi.hoisted(() => ({
  sendSchedule: vi.fn<(schedule: Schedule, token?: string) => Promise<boolean>>(async () => true),
  stopPush: vi.fn(async () => undefined),
}));
vi.mock("@/domain/pushClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domain/pushClient")>()),
  sendSchedule: push.sendSchedule,
  stopPush: push.stopPush,
}));

const MINUTE = 60_000;

function seed(reminders: ReminderSettings) {
  const now = Date.now();
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activities: [
      // Fed 2h40m ago, so the next feed reminder is 20 minutes away...
      { id: "f", type: "bottle", amount: 120, startedAt: new Date(now - 160 * MINUTE).toISOString() },
      // ...and changed 2h10m ago, so the nappy reminder was due 10 minutes ago.
      { id: "d", type: "diaper", diaperKind: "wet", startedAt: new Date(now - 130 * MINUTE).toISOString() },
    ],
    profile: { name: "Mia", birthDate: "2026-09-01", feedingMode: "mixed" },
    nightMode: false,
    onboardingComplete: true,
    reminders,
  }));
  return now;
}

/** The last schedule sent, as it goes over the wire. */
async function sent(): Promise<Schedule> {
  await waitFor(() => expect(push.sendSchedule).toHaveBeenCalled(), { timeout: 5_000 });
  return JSON.parse(JSON.stringify(push.sendSchedule.mock.lastCall![0]));
}

beforeEach(() => {
  stubBrowser();
  vi.stubGlobal("Notification", { permission: "granted" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  push.sendSchedule.mockClear();
  push.stopPush.mockClear();
});

test("an overdue nappy reminder does not go along with the new feed time", async () => {
  const now = seed({ feedEnabled: true, feedIntervalMinutes: 180, diaperEnabled: true, diaperIntervalMinutes: 120 });
  render(<App />);

  const schedule = await sent();
  expect(Object.keys(schedule)).toEqual(["feedDueAt"]);
  expect(Date.parse(schedule.feedDueAt!) - now).toBeGreaterThan(19 * MINUTE);
  // Nor did opening the app stop push first. Before the saved settings were
  // read every reminder looked off, so each cold start unsubscribed the phone
  // and deleted its alarm, racing the schedule that followed.
  expect(push.stopPush).not.toHaveBeenCalled();
});

test("feed reminders off, with the nappy one overdue, still clears the feed alarm", async () => {
  seed({ feedEnabled: false, feedIntervalMinutes: 180, diaperEnabled: true, diaperIntervalMinutes: 120 });
  render(<App />);

  // A null, which the server accepts — not a stop, which would also end the
  // nappy reminder that is still on.
  expect(await sent()).toEqual({ feedDueAt: null });
  expect(push.stopPush).not.toHaveBeenCalled();
});

// The recovery screen could not read the saved settings at all — every
// reminder looks off there. That must not tell the server to stop: it would
// unsubscribe the phone and delete the alarm the parent set.
test("the recovery screen does not switch off the reminders it could not read", async () => {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ activities: [], profile: null, onboardingComplete: true, reminders: { feedEnabled: true } }));
  render(<App />);
  await waitFor(() => expect(document.body.textContent).toMatch(/could not be read/), { timeout: 5_000 });
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(push.stopPush).not.toHaveBeenCalled();
  expect(push.sendSchedule).not.toHaveBeenCalled();
});
