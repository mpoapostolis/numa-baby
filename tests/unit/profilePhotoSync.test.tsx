/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getLocalPhoto, putLocalPhoto } from "@/lib/photos";
import { STORAGE_KEY, useTrackerStore } from "@/hooks/useTrackerStore";
import { parseStoredData, sanitizeProfile } from "@/domain/validate";

// The baby's profile picture is a photo id on the profile — a few dozen
// bytes, because the profile rides every pull (worker/index.ts caps it at
// 8 KB). These are the doors a profile comes in through; each rebuilds it
// field by field and would drop a key it did not know.

const base = { name: "Mia", birthDate: "2026-06-15", feedingMode: "mixed" };
const ID = "3f6c1d2e-9a4b-4c1d-8e2f-112233445566";

function blob(profile: object, profileUpdatedAt = "2026-10-01T00:00:00.000Z") {
  return JSON.stringify({ activities: [], profile, profileUpdatedAt, onboardingComplete: true });
}

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

test("the photo survives being stored and read back", () => {
  expect(parseStoredData(blob({ ...base, photo: ID })).profile.photo).toBe(ID);
  // Not a photo id: dropped, the profile is not.
  expect(parseStoredData(blob({ ...base, photo: "../../etc" })).profile.photo).toBeUndefined();
});

test("from the other phone: a photo, a deliberate removal, or silence", () => {
  expect(sanitizeProfile({ ...base, photo: ID })?.photo).toBe(ID);
  // "" is the family removing it — a real edit that must travel.
  expect(sanitizeProfile({ ...base, photo: "" })?.photo).toBe("");
  // Absent is a phone on an older build that has never heard of photos.
  expect(sanitizeProfile(base)?.photo).toBeUndefined();
});

test("a phone on an older build does not remove the photo by renaming the baby", async () => {
  window.localStorage.setItem(STORAGE_KEY, blob({ ...base, photo: ID }));
  const { result } = renderHook(() =>
    useTrackerStore({ debugMode: false, showToast: () => {}, onNotificationPermission: () => {} }),
  );
  await waitFor(() => expect(result.current.profile.photo).toBe(ID));
  act(() => {
    result.current.mergeRemote([], { ...base, name: "Mia Rose" } as never, "2026-10-12T00:00:00.000Z");
  });
  expect(result.current.profile.name).toBe("Mia Rose");
  expect(result.current.profile.photo).toBe(ID);
});

test("erasing everything on this phone erases its photos too", async () => {
  window.localStorage.setItem(STORAGE_KEY, blob({ ...base, photo: ID }));
  await putLocalPhoto(ID, new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }));
  const { result } = renderHook(() =>
    useTrackerStore({ debugMode: false, showToast: () => {}, onNotificationPermission: () => {} }),
  );
  await waitFor(() => expect(result.current.profile.photo).toBe(ID));
  vi.spyOn(window, "confirm").mockReturnValue(true);
  act(() => {
    result.current.eraseAllData();
  });
  await waitFor(async () => expect(await getLocalPhoto(ID)).toBeNull());
});

test("keeping a photo the incoming profile lacks re-stamps the profile, so the photo travels back", async () => {
  // The other phone saved the birth date a moment before it heard of the
  // photo: its newer profile has none. Keeping ours under ITS stamp would
  // leave the two phones disagreeing for good.
  window.localStorage.setItem(STORAGE_KEY, blob({ ...base, photo: ID }));
  const { result } = renderHook(() =>
    useTrackerStore({ debugMode: false, showToast: () => {}, onNotificationPermission: () => {} }),
  );
  await waitFor(() => expect(result.current.profile.photo).toBe(ID));
  act(() => {
    result.current.mergeRemote([], { ...base, birthDate: "2026-06-16" } as never, "2026-10-12T00:00:00.000Z");
  });
  const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { profileUpdatedAt: string; profile: { photo?: string; birthDate: string } };
  expect(stored.profile).toMatchObject({ photo: ID, birthDate: "2026-06-16" });
  expect(stored.profileUpdatedAt > "2026-10-12T00:00:00.000Z").toBe(true);
});

function storeWith(profile: object, profileUpdatedAt?: string) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ activities: [], profile, profileUpdatedAt, onboardingComplete: true }));
  return renderHook(() =>
    useTrackerStore({ debugMode: false, showToast: () => {}, onNotificationPermission: () => {} }),
  );
}

// The second phone to update had adopted the photo profile while still on
// the old build, which could not keep the field — under the same stamp, so
// "newer wins" alone would never hand it the photo.
test("a phone that took the photo's profile on an older build gets the photo once it updates", async () => {
  const stamp = "2026-10-12T09:00:00.000Z";
  const { result } = storeWith(base, stamp);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));
  act(() => {
    result.current.mergeRemote([], { ...base, photo: ID } as never, stamp);
  });
  expect(result.current.profile.photo).toBe(ID);
});

// A partner's clock ten minutes fast: the kept photo must be stamped after
// their edit, or every pull would keep it, re-stamp it and be refused again.
test("a kept photo is stamped after the edit it was kept through, whatever the clocks say", async () => {
  const { result } = storeWith({ ...base, photo: ID }, "2026-10-01T00:00:00.000Z");
  await waitFor(() => expect(result.current.profile.photo).toBe(ID));
  const ahead = new Date(Date.now() + 10 * 60_000).toISOString();
  act(() => {
    result.current.mergeRemote([], { ...base, name: "Mia Rose" } as never, ahead);
  });
  expect(result.current.profile.photo).toBe(ID);
  const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
  expect(new Date(stored.profileUpdatedAt).getTime()).toBeGreaterThan(new Date(ahead).getTime());
});

// Joining a family, this phone's profile gives way (its stamp is taken
// away). Its own old picture must not become the family's.
test("a joining phone's own baby picture does not become the family's", async () => {
  const { result } = storeWith({ ...base, photo: ID }, undefined);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));
  act(() => {
    result.current.mergeRemote([], { ...base, name: "Leo" } as never, "2026-10-12T09:00:00.000Z");
  });
  expect(result.current.profile.name).toBe("Leo");
  expect(result.current.profile.photo).toBeUndefined();
});
