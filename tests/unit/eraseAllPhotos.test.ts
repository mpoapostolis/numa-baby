/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { STORAGE_KEY, useTrackerStore } from "@/hooks/useTrackerStore";
import { Activity } from "@/domain/types";

// A backup file carries the entries, not the photos. "Download a backup
// first" on its own was advice that lost every photo it was followed by.

const PHOTO = "0b6c3a52-6f0e-4f43-9d8a-0e4c3c1e2f10";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function seed(activities: Activity[], photo?: string) {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activities,
    profile: { name: "Mia", birthDate: "2026-09-01", feedingMode: "mixed", ...(photo ? { photo } : {}) },
    nightMode: false,
    onboardingComplete: true,
  }));
}

async function askToErase() {
  const { result } = renderHook(() =>
    useTrackerStore({ debugMode: false, showToast: () => {}, onNotificationPermission: () => {} }),
  );
  await waitFor(() => expect(result.current.bootState).toBe("ready"));
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  act(() => {
    result.current.eraseAllData();
  });
  return String(confirm.mock.calls[0][0]);
}

test("the erase question names the photos, and says a backup does not keep them", async () => {
  const at = new Date(Date.now() - 3_600_000).toISOString();
  seed([
    { id: "a", type: "diaper", diaperKind: "dirty", startedAt: at, photo: "1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b" },
    { id: "b", type: "bottle", amount: 90, startedAt: at },
  ], PHOTO);
  const question = await askToErase();
  expect(question).toContain("2 entries and 2 photos will be deleted");
  expect(question).toContain("A backup keeps your entries but not photos");
});

test("with no photos, the question is the one it always was", async () => {
  seed([{ id: "b", type: "bottle", amount: 90, startedAt: new Date(Date.now() - 3_600_000).toISOString() }]);
  const question = await askToErase();
  expect(question).toContain("1 entry will be deleted");
  expect(question).toContain("Download a backup first");
});
