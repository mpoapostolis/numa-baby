/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const forgetPhoto = vi.fn(async () => {});
const deleteLocalPhoto = vi.fn(async () => {});
const getLocalPhoto = vi.fn(async (): Promise<Blob | null> => new Blob([new Uint8Array([0xff, 0xd8, 0xff])]));
const releaseDeletedPhotos = vi.fn(async () => {});
vi.mock("@/lib/photos", () => ({ forgetPhoto, deleteLocalPhoto, getLocalPhoto, releaseDeletedPhotos, clearAllPhotos: vi.fn() }));

import { STORAGE_KEY, useTrackerStore } from "@/hooks/useTrackerStore";
import { Activity } from "@/domain/types";

// A deleted entry's photo goes too — but only once Undo can no longer bring
// the entry back, or Undo would revive a nappy pointing at nothing. That is
// when the toast leaves the screen, not after a fixed few seconds: its timer
// pauses while the app is in the background or a finger rests on it.

const PHOTO = "3f6c1d2e-9a4b-4c1d-8e2f-112233445566";
const nappy: Activity = { id: "n1", type: "diaper", diaperKind: "dirty", photo: PHOTO, startedAt: new Date(Date.now() - 60_000).toISOString() };

function seed(activities: Activity[] = [nappy]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activities,
    profile: { name: "Mia", birthDate: "2026-06-15", feedingMode: "mixed" },
    onboardingComplete: true,
  }));
}

beforeEach(() => {
  window.localStorage.clear();
  forgetPhoto.mockClear();
  deleteLocalPhoto.mockClear();
  getLocalPhoto.mockClear();
  releaseDeletedPhotos.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type Toast = { undo?: () => void; gone?: () => void };

async function store(toasts: Toast[], activities?: Activity[]) {
  seed(activities);
  const hook = renderHook(() =>
    useTrackerStore({ debugMode: false, showToast: (_m, undo, gone) => toasts.push({ undo, gone }), onNotificationPermission: () => {} }),
  );
  await waitFor(() => expect(hook.result.current.bootState).toBe("ready"));
  return hook;
}

test("a deleted entry's photo is let go of when its toast has gone", async () => {
  const toasts: Toast[] = [];
  const { result } = await store(toasts);
  act(() => {
    result.current.removeActivity(nappy);
  });
  expect(forgetPhoto).not.toHaveBeenCalled();
  act(() => toasts[toasts.length - 1].gone?.());
  await waitFor(() => expect(forgetPhoto).toHaveBeenCalledWith(PHOTO));
});

test("an Undo still on screen after a long while still brings the photo back", async () => {
  const toasts: Toast[] = [];
  const { result } = await store(toasts);
  vi.useFakeTimers();
  act(() => {
    result.current.removeActivity(nappy);
  });
  // The parent switched apps; the toast waited for them.
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect(forgetPhoto).not.toHaveBeenCalled();
  const toast = toasts[toasts.length - 1];
  act(() => toast.undo?.());
  act(() => toast.gone?.());
  await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
  expect(forgetPhoto).not.toHaveBeenCalled();
});

test("a pull during the Undo window leaves the deleted entry's photo alone", async () => {
  const toasts: Toast[] = [];
  const { result } = await store(toasts);
  act(() => {
    result.current.removeActivity(nappy);
  });
  act(() => {
    result.current.mergeRemote([{ id: "b-partner", type: "bottle", amount: 90, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]);
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  // The pull did change something — the partner's bottle is here.
  expect(result.current.activities.some((a) => a.id === "b-partner")).toBe(true);
  expect(deleteLocalPhoto).not.toHaveBeenCalled();
  expect(forgetPhoto).not.toHaveBeenCalled();
});

test("an app closed before the toast went lets the photo go on its next start", async () => {
  const deletedAt = new Date(Date.now() - 30_000).toISOString();
  await store([], [{ ...nappy, deleted: true, updatedAt: deletedAt }]);
  await waitFor(() => expect(releaseDeletedPhotos).toHaveBeenCalled(), { timeout: 5_000 });
  const [list] = releaseDeletedPhotos.mock.calls[0] as unknown as [Activity[]];
  expect(list.find((item) => item.id === nappy.id)).toMatchObject({ deleted: true, photo: PHOTO });
}, 10_000);

test("a log with no deleted photos does not load the photo code at start", async () => {
  await store([]);
  await new Promise((resolve) => setTimeout(resolve, 3_500));
  expect(releaseDeletedPhotos).not.toHaveBeenCalled();
}, 10_000);

test("the photo let go of is the stored one, not an older copy's", async () => {
  const toasts: Toast[] = [];
  const { result } = await store(toasts);
  // A list row rendered before the photo was added.
  const stale: Activity = { ...nappy };
  delete stale.photo;
  act(() => {
    result.current.removeActivity(stale);
  });
  act(() => toasts[toasts.length - 1].gone?.());
  await waitFor(() => expect(forgetPhoto).toHaveBeenCalledWith(PHOTO));
});

test("a deleted entry the other parent wrote again with another photo lets this phone's old one go", async () => {
  const toasts: Toast[] = [];
  const { result } = await store(toasts);
  act(() => {
    result.current.removeActivity(nappy);
  });
  const later = new Date(Date.now() + 1_000).toISOString();
  act(() => {
    result.current.mergeRemote([{ ...nappy, photo: "9a8b7c6d-their-photo", updatedAt: later }]);
  });
  await waitFor(() => expect(deleteLocalPhoto).toHaveBeenCalledWith(PHOTO));
});

test("the other parent deleting it takes this phone's copy too", async () => {
  const { result } = await store([]);
  act(() => {
    result.current.mergeRemote([{ ...nappy, deleted: true, updatedAt: new Date().toISOString() }]);
  });
  await waitFor(() => expect(deleteLocalPhoto).toHaveBeenCalledWith(PHOTO));
});

test("undoing a just-saved entry lets its photo go at once", async () => {
  const toasts: Toast[] = [];
  const { result } = await store(toasts);
  act(() => {
    result.current.addActivity({ id: "n2", type: "diaper", diaperKind: "wet", photo: "4a5b6c7d-just-saved", startedAt: new Date().toISOString() }, "saved");
  });
  act(() => {
    toasts[toasts.length - 1].undo?.();
  });
  await waitFor(() => expect(forgetPhoto).toHaveBeenCalledWith("4a5b6c7d-just-saved"));
});
