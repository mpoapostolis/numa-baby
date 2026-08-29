/** @vitest-environment jsdom */
import { ChangeEvent } from "react";
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

function storedActivities() {
  return (JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[] }).activities;
}

function isRecentIso(value: string | undefined) {
  return typeof value === "string" && Math.abs(Date.now() - new Date(value).getTime()) < 5_000;
}

test("add, update, stopTimer and remove all stamp updatedAt", async () => {
  const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  window.localStorage.setItem(STORAGE_KEY, makeBlob([
    makeActivity("timer", { type: "nursing", startedAt, diaperKind: undefined }),
    makeActivity("edit", { startedAt }),
    makeActivity("gone", { startedAt }),
  ]));
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  act(() => {
    result.current.addActivity(makeActivity("added"), "Saved");
  });
  act(() => {
    result.current.updateActivity({ ...result.current.activities.find((entry) => entry.id === "edit")!, note: "edited" });
  });
  act(() => {
    result.current.stopTimer("timer");
  });
  act(() => {
    result.current.removeActivity(result.current.activities.find((entry) => entry.id === "gone")!);
  });

  const stored = new Map(storedActivities().map((entry) => [entry.id, entry]));
  expect(isRecentIso(stored.get("added")?.updatedAt)).toBe(true);
  expect(isRecentIso(stored.get("edit")?.updatedAt)).toBe(true);
  expect(isRecentIso(stored.get("timer")?.updatedAt)).toBe(true);
  expect(stored.get("timer")?.endedAt).toBe(stored.get("timer")?.updatedAt);
  expect(isRecentIso(stored.get("gone")?.updatedAt)).toBe(true);
});

test("removing an entry writes a tombstone and undo revives it in place", async () => {
  window.localStorage.setItem(STORAGE_KEY, makeBlob([makeActivity("kept"), makeActivity("victim")]));
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  act(() => {
    result.current.removeActivity(result.current.activities.find((entry) => entry.id === "victim")!);
  });

  // The live view hides the tombstone; storage keeps it for a future sync merge.
  expect(result.current.activities.map((entry) => entry.id)).toEqual(["kept"]);
  const tombstone = storedActivities().find((entry) => entry.id === "victim");
  expect(tombstone?.deleted).toBe(true);
  expect(isRecentIso(tombstone?.updatedAt)).toBe(true);

  act(() => {
    toasts.find((entry) => entry.message === "Entry removed")?.undo?.();
  });

  expect(result.current.activities.map((entry) => entry.id).sort()).toEqual(["kept", "victim"]);
  const revived = storedActivities().find((entry) => entry.id === "victim");
  expect(revived?.deleted).toBeUndefined();
  expect("deleted" in (revived ?? {})).toBe(false);
  expect(isRecentIso(revived?.updatedAt)).toBe(true);
});

test("a legacy blob without updatedAt or deleted loads identically and is not rewritten", async () => {
  const legacy = makeBlob([makeActivity("old-1"), makeActivity("old-2", { type: "sleep", diaperKind: undefined })]);
  window.localStorage.setItem(STORAGE_KEY, legacy);
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  expect(result.current.activities.map((entry) => entry.id)).toEqual(["old-1", "old-2"]);
  expect(result.current.activities.every((entry) => entry.updatedAt === undefined && entry.deleted === undefined)).toBe(true);
  // Migration is lazy: loading must never rewrite the stored blob.
  expect(window.localStorage.getItem(STORAGE_KEY)).toBe(legacy);
});

test("tombstones older than 90 days are swept on the next persist", async () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const expiredAt = new Date(Date.now() - 91 * DAY_MS).toISOString();
  const recentAt = new Date(Date.now() - 10 * DAY_MS).toISOString();
  window.localStorage.setItem(STORAGE_KEY, makeBlob([
    makeActivity("live"),
    { ...makeActivity("expired"), deleted: true, updatedAt: expiredAt },
    // Legacy tombstone without updatedAt: its startedAt counts as the last write.
    { ...makeActivity("expired-legacy", { startedAt: expiredAt }), deleted: true },
    { ...makeActivity("recent"), deleted: true, updatedAt: recentAt },
  ]));
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  // Loading alone sweeps nothing — the blob is only rewritten by a real persist.
  expect(storedActivities().map((entry) => entry.id)).toEqual(["live", "expired", "expired-legacy", "recent"]);

  act(() => {
    result.current.addActivity(makeActivity("fresh"), "Saved");
  });

  expect(storedActivities().map((entry) => entry.id).sort()).toEqual(["fresh", "live", "recent"]);
  expect(result.current.activities.map((entry) => entry.id).sort()).toEqual(["fresh", "live"]);
});

test("importing a backup merges into the timeline instead of replacing it", async () => {
  const oldStamp = "2026-08-01T10:00:00.000Z";
  const newStamp = "2026-08-02T10:00:00.000Z";
  window.localStorage.setItem(STORAGE_KEY, makeBlob([
    makeActivity("local-only", { startedAt: oldStamp, updatedAt: oldStamp }),
    makeActivity("conflict", { note: "local wins", startedAt: oldStamp, updatedAt: newStamp }),
  ]));
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

  const backup = JSON.stringify({
    activities: [
      makeActivity("incoming-only", { startedAt: oldStamp, updatedAt: oldStamp }),
      makeActivity("conflict", { note: "backup loses", startedAt: oldStamp, updatedAt: oldStamp }),
    ],
    profile: { name: "Other Device", birthDate: "2026-05-01", feedingMode: "bottle" },
    onboardingComplete: true,
  });
  const file = new File([backup], "backup.json", { type: "application/json" });
  const event = { target: { files: [file], value: "" } } as unknown as ChangeEvent<HTMLInputElement>;
  act(() => {
    result.current.importData(event);
  });
  await waitFor(() => expect(toasts.some((entry) => entry.message.startsWith("Merged:"))).toBe(true));

  expect(confirm.mock.calls[0][0]).toContain("Merge this backup");
  expect(toasts.at(-1)?.message).toBe("Merged: 1 new, 0 updated, 2 unchanged");
  const stored = storedActivities();
  expect(stored.map((entry) => entry.id).sort()).toEqual(["conflict", "incoming-only", "local-only"]);
  // The newer local edit beat the stale backup copy.
  expect(stored.find((entry) => entry.id === "conflict")?.note).toBe("local wins");
  // The local profile is kept — a backup must not clobber a name edited here.
  expect(result.current.profile.name).toBe("Mia");
  // Rollback safety: the pre-merge state landed in the recovery slot.
  const recovery = JSON.parse(window.localStorage.getItem(RECOVERY_KEY)!) as { activities: Activity[] };
  expect(recovery.activities.map((entry) => entry.id).sort()).toEqual(["conflict", "local-only"]);
});

function stubShare(canShare: boolean, share: (data?: ShareData) => Promise<void>) {
  Object.defineProperty(navigator, "canShare", { value: () => canShare, configurable: true });
  Object.defineProperty(navigator, "share", { value: vi.fn(share), configurable: true });
  return () => {
    delete (navigator as { canShare?: unknown }).canShare;
    delete (navigator as { share?: unknown }).share;
  };
}

test("sharePartner shares the full list, tombstones included, and toasts", async () => {
  window.localStorage.setItem(STORAGE_KEY, makeBlob([
    makeActivity("live"),
    { ...makeActivity("gone"), deleted: true, updatedAt: new Date().toISOString() },
  ]));
  let sharedFile: File | undefined;
  const restore = stubShare(true, async (data) => {
    sharedFile = data?.files?.[0] as File | undefined;
  });
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  await act(async () => {
    await result.current.sharePartner();
  });
  restore();

  expect(sharedFile?.name).toMatch(/^baby-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(sharedFile?.type).toBe("application/json");
  const payload = JSON.parse(await sharedFile!.text()) as { activities: Activity[]; profile: { name: string } };
  // The share is a sync artifact: the tombstone must travel so the partner's
  // merge can carry the deletion, not resurrect the entry.
  expect(payload.activities.map((entry) => entry.id).sort()).toEqual(["gone", "live"]);
  expect(payload.activities.find((entry) => entry.id === "gone")?.deleted).toBe(true);
  expect(payload.profile.name).toBe("Mia");
  expect(toasts.at(-1)?.message).toBe("Shared — have your partner open it in their Numalog");
});

test("a cancelled share stays silent", async () => {
  window.localStorage.setItem(STORAGE_KEY, makeBlob([makeActivity("kept")]));
  const restore = stubShare(true, () => Promise.reject(new DOMException("cancelled", "AbortError")));
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  await act(async () => {
    await result.current.sharePartner();
  });
  restore();

  expect(toasts).toEqual([]);
});

test("sharePartner falls back to the download when sharing is unavailable", async () => {
  window.localStorage.setItem(STORAGE_KEY, makeBlob([makeActivity("kept")]));
  const createObjectURL = vi.fn(() => "blob:mock");
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  await act(async () => {
    await result.current.sharePartner();
  });
  delete (URL as { createObjectURL?: unknown }).createObjectURL;
  delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;

  expect(click).toHaveBeenCalledTimes(1);
  expect(createObjectURL).toHaveBeenCalledTimes(1);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  expect(toasts.at(-1)?.message).toBe("Backup saved to your device");
});

test("undoing a delete after a new entry landed revives the victim and keeps the newcomer", async () => {
  window.localStorage.setItem(STORAGE_KEY, makeBlob([makeActivity("kept"), makeActivity("victim")]));
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  act(() => {
    result.current.removeActivity(result.current.activities.find((entry) => entry.id === "victim")!);
  });
  const undoDelete = toasts.find((entry) => entry.message === "Entry removed")?.undo;
  expect(undoDelete).toBeDefined();
  // A brand-new entry lands while the undo toast is still up.
  act(() => {
    result.current.addActivity(makeActivity("newborn"), "Saved");
  });
  act(() => {
    undoDelete?.();
  });

  // The undo revived exactly the victim — the newcomer survived, in state and storage.
  expect(result.current.activities.map((entry) => entry.id).sort()).toEqual(["kept", "newborn", "victim"]);
  const stored = new Map(storedActivities().map((entry) => [entry.id, entry]));
  expect(stored.size).toBe(3);
  expect(stored.get("victim")?.deleted).toBeUndefined();
  expect("deleted" in stored.get("victim")!).toBe(false);
  expect(isRecentIso(stored.get("victim")?.updatedAt)).toBe(true);
  expect(isRecentIso(stored.get("newborn")?.updatedAt)).toBe(true);
});

test("export then import of the same data is the identity: zero new, zero updated", async () => {
  const recentTombstoneAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  window.localStorage.setItem(STORAGE_KEY, makeBlob([
    makeActivity("legacy-live"), // legacy row: no updatedAt at all
    makeActivity("edited", { note: "final wording", updatedAt: new Date().toISOString() }),
    { ...makeActivity("gone"), deleted: true, updatedAt: recentTombstoneAt },
  ]));
  let sharedFile: File | undefined;
  const restore = stubShare(true, async (data) => {
    sharedFile = data?.files?.[0] as File | undefined;
  });
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));
  const before = [...storedActivities()].sort((a, b) => a.id.localeCompare(b.id));

  await act(async () => {
    await result.current.sharePartner();
  });
  restore();
  const payload = await sharedFile!.text();

  vi.spyOn(window, "confirm").mockReturnValue(true);
  const file = new File([payload], "backup.json", { type: "application/json" });
  const event = { target: { files: [file], value: "" } } as unknown as ChangeEvent<HTMLInputElement>;
  act(() => {
    result.current.importData(event);
  });
  await waitFor(() => expect(toasts.some((entry) => entry.message.startsWith("Merged:"))).toBe(true));

  // Idempotence, as the parent sees it: nothing new, nothing "updated".
  expect(toasts.at(-1)?.message).toBe("Merged: 0 new, 0 updated, 3 unchanged");
  const after = [...storedActivities()].sort((a, b) => a.id.localeCompare(b.id));
  expect(after).toStrictEqual(before);
  expect(result.current.activities.map((entry) => entry.id).sort()).toEqual(["edited", "legacy-live"]);
});

test("a pre-schema backup (no updatedAt anywhere) merges by startedAt and stays unstamped", async () => {
  const oldDay = "2026-07-01T10:00:00.000Z";
  const newerStamp = "2026-08-05T10:00:00.000Z";
  window.localStorage.setItem(STORAGE_KEY, makeBlob([
    makeActivity("conflict", { note: "edited here later", startedAt: oldDay, updatedAt: newerStamp }),
    makeActivity("local-only", { startedAt: oldDay, updatedAt: oldDay }),
  ]));
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));
  vi.spyOn(window, "confirm").mockReturnValue(true);

  // The backup predates the schema: no updatedAt, no deleted, no exportedAt.
  const backup = JSON.stringify({
    activities: [
      { id: "conflict", type: "diaper", diaperKind: "wet", startedAt: oldDay, note: "stale wording" },
      { id: "from-old-phone", type: "diaper", diaperKind: "wet", startedAt: oldDay },
    ],
    profile: { name: "Mia", birthDate: "2026-05-01", feedingMode: "mixed" },
    nightMode: false,
    reminders: { feedEnabled: false, feedIntervalMinutes: 180 },
    onboardingComplete: true,
  });
  const file = new File([backup], "old-backup.json", { type: "application/json" });
  const event = { target: { files: [file], value: "" } } as unknown as ChangeEvent<HTMLInputElement>;
  act(() => {
    result.current.importData(event);
  });
  await waitFor(() => expect(toasts.some((entry) => entry.message.startsWith("Merged:"))).toBe(true));

  expect(toasts.at(-1)?.message).toBe("Merged: 1 new, 0 updated, 2 unchanged");
  const stored = new Map(storedActivities().map((entry) => [entry.id, entry]));
  // The stamped local edit beat the legacy copy (startedAt is its last write).
  expect(stored.get("conflict")?.note).toBe("edited here later");
  // The adopted legacy row is stored as-is — merging must not invent stamps.
  expect(stored.get("from-old-phone")).toStrictEqual({ id: "from-old-phone", type: "diaper", diaperKind: "wet", startedAt: oldDay });
});

test("a post-schema backup carries a deletion into a legacy tracker", async () => {
  const oldDay = "2026-07-01T10:00:00.000Z";
  const legacyRows = [
    makeActivity("old-1", { startedAt: oldDay }),
    makeActivity("old-2", { startedAt: oldDay }),
  ];
  window.localStorage.setItem(STORAGE_KEY, makeBlob(legacyRows));
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));
  vi.spyOn(window, "confirm").mockReturnValue(true);

  const deletionStamp = new Date().toISOString();
  const backup = JSON.stringify({
    activities: [
      { id: "old-1", type: "diaper", diaperKind: "wet", startedAt: oldDay, deleted: true, updatedAt: deletionStamp },
      { id: "from-partner", type: "diaper", diaperKind: "wet", startedAt: oldDay, updatedAt: deletionStamp },
    ],
    profile: { name: "Mia", birthDate: "2026-05-01", feedingMode: "mixed" },
    onboardingComplete: true,
  });
  const file = new File([backup], "partner-backup.json", { type: "application/json" });
  const event = { target: { files: [file], value: "" } } as unknown as ChangeEvent<HTMLInputElement>;
  act(() => {
    result.current.importData(event);
  });
  await waitFor(() => expect(toasts.some((entry) => entry.message.startsWith("Merged:"))).toBe(true));

  // The partner's deletion wins over the legacy row; the arriving tombstone
  // counts as an update to it.
  expect(toasts.at(-1)?.message).toBe("Merged: 1 new, 1 updated, 1 unchanged");
  expect(result.current.activities.map((entry) => entry.id).sort()).toEqual(["from-partner", "old-2"]);
  const stored = new Map(storedActivities().map((entry) => [entry.id, entry]));
  expect(stored.get("old-1")?.deleted).toBe(true);
  // The untouched legacy row is preserved byte-for-byte — still unstamped.
  expect(stored.get("old-2")).toStrictEqual(legacyRows[1]);
});

test("a legacy blob survives a real persist: old rows unchanged, only the new row stamped", async () => {
  const oldDay = "2026-07-01T10:00:00.000Z";
  const legacyRows = [
    makeActivity("old-1", { startedAt: oldDay }),
    makeActivity("old-2", { type: "sleep", diaperKind: undefined, startedAt: oldDay, endedAt: "2026-07-01T11:00:00.000Z" }),
  ];
  window.localStorage.setItem(STORAGE_KEY, makeBlob(legacyRows));
  const toasts: Toast[] = [];
  const { result } = renderStore(toasts);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  act(() => {
    result.current.addActivity(makeActivity("fresh"), "Saved");
  });

  const stored = storedActivities();
  expect(stored).toHaveLength(3);
  const byId = new Map(stored.map((entry) => [entry.id, entry]));
  // The legacy rows round-tripped through a persist without gaining any key.
  expect(byId.get("old-1")).toStrictEqual({ id: "old-1", type: "diaper", diaperKind: "wet", startedAt: oldDay });
  expect(byId.get("old-2")).toStrictEqual({ id: "old-2", type: "sleep", startedAt: oldDay, endedAt: "2026-07-01T11:00:00.000Z" });
  expect(isRecentIso(byId.get("fresh")?.updatedAt)).toBe(true);
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

// —— Pairing on a legacy install ——————————————————————————————————
// Both of these were found by running the real two-device flow, not by
// reading the code: a phone that has been logging since before sync existed
// carries no profile stamp, and a partner's phone carries nothing at all.

test("starting a family makes an unstamped legacy profile syncable", async () => {
  window.localStorage.setItem(STORAGE_KEY, makeBlob([makeActivity("a1")]));
  const { result } = renderStore([]);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  // A blob written before sync existed has no stamp, and the push only sends
  // stamped profiles — so without this the partner never learns the name.
  expect(result.current.readPersisted().profileUpdatedAt).toBeUndefined();

  act(() => result.current.stampProfileForSync());

  const stamped = result.current.readPersisted();
  expect(stamped.profileUpdatedAt).toBeDefined();
  expect(stamped.profile.name).toBe("Mia");
  // Stamping is not an edit: not one entry may move.
  expect(stamped.activities.map((a) => a.id)).toEqual(["a1"]);
});

test("stamping never overwrites a stamp that already exists", async () => {
  const existing = "2026-01-01T00:00:00.000Z";
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...JSON.parse(makeBlob()),
    profileUpdatedAt: existing,
  }));
  const { result } = renderStore([]);
  await waitFor(() => expect(result.current.bootState).toBe("ready"));

  act(() => result.current.stampProfileForSync());

  expect(result.current.readPersisted().profileUpdatedAt).toBe(existing);
});

test("stamping does nothing on a phone with no profile of its own", async () => {
  const { result } = renderStore([]);
  await waitFor(() => expect(result.current.bootState).toBe("onboarding"));

  act(() => result.current.stampProfileForSync());

  // An empty default must stay unstamped, or a joining phone would out-rank
  // the family's real profile on the first pull.
  expect(result.current.readPersisted().profileUpdatedAt).toBeUndefined();
});

test("joining a family reaches ready without inventing a profile", async () => {
  const { result } = renderStore([]);
  await waitFor(() => expect(result.current.bootState).toBe("onboarding"));

  act(() => { result.current.completeJoin(); });

  // The sync engine refuses to pull before "ready", so a phone stuck in
  // onboarding would pair and then never receive anything.
  expect(result.current.bootState).toBe("ready");
  const persisted = result.current.readPersisted();
  expect(persisted.profile.name).toBe("");
  expect(persisted.profileUpdatedAt).toBeUndefined();
  expect(persisted.activities).toEqual([]);
});
