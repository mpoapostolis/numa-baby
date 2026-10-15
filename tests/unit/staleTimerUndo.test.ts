/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { STORAGE_KEY, useTrackerStore } from "@/hooks/useTrackerStore";
import { Activity } from "@/domain/types";
import { seedLog } from "./appHarness";

// A timer running past 18h asks before it saves. Cancel discards it, and
// Cancel is also how people back out of a dialog: the discard needs the
// same Undo every other removal has.

type Toast = { message: string; undo?: () => void };

const started = Date.parse("2026-10-14T20:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ now: started + (19 * 60 + 30) * 60_000, toFake: ["Date"] });
  seedLog([{ id: "night", type: "sleep", startedAt: new Date(started).toISOString(), updatedAt: new Date(started).toISOString() }]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function stored(id: string) {
  return (JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[] }).activities.find((a) => a.id === id);
}

async function discardTheNight() {
  const toasts: Toast[] = [];
  const hook = renderHook(() =>
    useTrackerStore({ debugMode: false, showToast: (message, undo) => toasts.push({ message, undo }), onNotificationPermission: () => {} }),
  );
  await waitFor(() => expect(hook.result.current.bootState).toBe("ready"));
  vi.spyOn(window, "confirm").mockReturnValue(false);
  act(() => hook.result.current.stopTimer("night"));
  expect(stored("night")?.deleted).toBe(true);
  const toast = toasts.at(-1);
  expect(toast?.message).toBe("Timer discarded — nothing was added to the log");
  return { ...hook, toasts, undo: toast?.undo };
}

test("Undo after Cancel brings the discarded timer back, still running", async () => {
  const { result, toasts, undo } = await discardTheNight();
  expect(undo).toBeDefined();
  const tombstonedAt = stored("night")!.updatedAt!;

  vi.setSystemTime(Date.now() + 2_000);
  act(() => undo!());

  const night = stored("night")!;
  expect(night.deleted).toBeUndefined();
  expect(night.endedAt).toBeUndefined();
  // A fresh stamp, so the revival beats the tombstone on the other phone too.
  expect(night.updatedAt! > tombstonedAt).toBe(true);
  expect(result.current.activities.find((a) => a.id === "night")?.endedAt).toBeUndefined();
  expect(toasts.at(-1)?.message).toBe("Timer resumed");
});

test("Undo does not bring it back over a timer of the same kind started since", async () => {
  const { result, toasts, undo } = await discardTheNight();
  act(() => {
    result.current.addActivity({ id: "nap", type: "sleep", startedAt: new Date().toISOString() }, "Sleep started");
  });
  act(() => undo!());
  expect(stored("night")?.deleted).toBe(true);
  expect(toasts.at(-1)?.message).toBe("Another sleep timer is already running — stop that one first.");
});
