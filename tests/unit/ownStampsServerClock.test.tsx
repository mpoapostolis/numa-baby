/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { STORAGE_KEY, useTrackerStore } from "@/hooks/useTrackerStore";

// A row edited while this phone's clock ran ten days fast keeps that stamp
// in its own log — the log is never fenced against this phone's clock,
// which a flat battery can wind back. Against the SERVER's clock, on the
// next pull, it becomes "written now", so the other parent's later edits
// and deletions win again.

afterEach(() => cleanup());

test("own rows stamped far ahead of the server's clock are brought back to it on a pull", async () => {
  const now = Date.now();
  const future = new Date(now + 10 * 86_400_000).toISOString();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activities: [{ id: "edited", type: "bottle", amount: 120, startedAt: new Date(now - 3_600_000).toISOString(), updatedAt: future }],
    profile: { name: "Mia", birthDate: "2026-06-15", feedingMode: "mixed" },
    onboardingComplete: true,
  }));
  const { result } = renderHook(() => useTrackerStore({ debugMode: false, showToast: () => {}, onNotificationPermission: () => {} }));
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  // Kept as it is at boot: this phone's clock is not the judge.
  expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).activities[0].updatedAt).toBe(future);

  act(() => {
    result.current.mergeRemote([], undefined, undefined, now);
  });
  const stamp = Date.parse(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).activities[0].updatedAt);
  expect(stamp).toBeLessThanOrEqual(now + 1_000);

  // And then a partner's deletion, made after, wins.
  act(() => {
    result.current.mergeRemote([{ id: "edited", type: "bottle", amount: 120, startedAt: new Date(now - 3_600_000).toISOString(), updatedAt: new Date(now + 60_000).toISOString(), deleted: true }], undefined, undefined, now + 60_000);
  });
  expect(result.current.activities.some((activity) => activity.id === "edited")).toBe(false);
});
