/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { RECOVERY_KEY, STORAGE_KEY, useTrackerStore } from "@/hooks/useTrackerStore";
import { Activity } from "@/domain/types";

// Permanent regression suite for the W1 persistence contract: undo is an
// inverse operation, writes are persist-first, corrupt data is preserved, and
// the recovery screen never writes over the blob it promises to keep.

type Toast = { message: string; undo?: () => void };

function makeBlob(activities: Activity[] = []) {
  return JSON.stringify({
    activities,
    profile: { name: "Mia", birthDate: "2026-05-01", feedingMode: "mixed" },
    nightMode: false,
    reminders: { feedEnabled: false, feedIntervalMinutes: 180 },
    onboardingComplete: true,
  });
}

function makeActivity(id: string, overrides: Partial<Activity> = {}): Activity {
  return { id, type: "diaper", diaperKind: "wet", startedAt: new Date().toISOString(), ...overrides };
}

function renderStore(toasts: Toast[]) {
  return renderHook(() =>
    useTrackerStore({
      debugMode: false,
      showToast: (message, undo) => toasts.push({ message, undo }),
      onNotificationPermission: () => {},
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("undoing the first of two adds keeps the second, in state and in storage", async () => {
  window.localStorage.setItem(STORAGE_KEY, makeBlob());
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  act(() => {
    result.current.addActivity(makeActivity("first"), "First saved");
  });
  const undoFirst = toasts.find((entry) => entry.message === "First saved")?.undo;
  expect(undoFirst).toBeDefined();
  act(() => {
    result.current.addActivity(makeActivity("second"), "Second saved");
  });
  act(() => {
    undoFirst?.();
  });

  expect(result.current.activities.map((entry) => entry.id)).toEqual(["second"]);
  const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[] };
  expect(stored.activities.map((entry) => entry.id)).toEqual(["second"]);
});

test("a failed localStorage write changes nothing, warns and returns false", async () => {
  window.localStorage.setItem(STORAGE_KEY, makeBlob([makeActivity("keep")]));
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota exceeded");
  });
  let saved = true;
  act(() => {
    saved = result.current.addActivity(makeActivity("lost"), "Saved");
  });

  expect(saved).toBe(false);
  expect(result.current.activities.map((entry) => entry.id)).toEqual(["keep"]);
  expect(result.current.storageWarning).toContain("could not save");
  vi.restoreAllMocks();
  const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[] };
  expect(stored.activities.map((entry) => entry.id)).toEqual(["keep"]);
});

test("a storage event with a valid blob rehydrates this tab", async () => {
  window.localStorage.setItem(STORAGE_KEY, makeBlob());
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  act(() => {
    window.dispatchEvent(new StorageEvent("storage", {
      key: STORAGE_KEY,
      newValue: makeBlob([makeActivity("from-another-tab")]),
    }));
  });

  expect(result.current.activities.map((entry) => entry.id)).toEqual(["from-another-tab"]);
  expect(result.current.bootState).toBe("ready");
  expect(result.current.profile.name).toBe("Mia");
});

test("a corrupt boot blob lands in recovery and is never overwritten", async () => {
  const corrupt = '{"activities":"not-an-array"}';
  window.localStorage.setItem(STORAGE_KEY, corrupt);
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("recovery"));

  expect(result.current.storageWarning).toContain("could not be read");
  expect(window.localStorage.getItem(STORAGE_KEY)).toBe(corrupt);
  expect(window.localStorage.getItem(RECOVERY_KEY)).toBe(corrupt);
});

test("changing night mode on the recovery screen persists nothing", async () => {
  const corrupt = '{"activities":"not-an-array"}';
  window.localStorage.setItem(STORAGE_KEY, corrupt);
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("recovery"));

  const setItem = vi.spyOn(Storage.prototype, "setItem");
  act(() => {
    result.current.changeNightMode(true);
  });

  expect(result.current.nightMode).toBe(true);
  expect(setItem).not.toHaveBeenCalled();
  expect(window.localStorage.getItem(STORAGE_KEY)).toBe(corrupt);
});
