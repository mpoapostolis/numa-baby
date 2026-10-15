/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { STORAGE_KEY, useTrackerStore } from "@/hooks/useTrackerStore";
import { useFamilySync } from "@/hooks/useFamilySync";
import { FAMILY_KEY } from "@/domain/familyPairing";
import { Activity } from "@/domain/types";
import { seedLog } from "./appHarness";

// What happens to a pull that is still in flight when something else moves
// underneath it: a switch to another family, or a backup merged in.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function useBoth(toasts: string[] = []) {
  const store = useTrackerStore({ debugMode: false, showToast: (message) => toasts.push(message), onNotificationPermission: () => {} });
  const sync = useFamilySync({
    debugMode: false, bootState: store.bootState, persistVersion: store.persistVersion,
    backfillVersion: store.backfillVersion, backfillOldestAt: store.backfillOldestAt,
    readPersisted: store.readPersisted, stampProfileForSync: store.stampProfileForSync,
    demoteProfileForJoin: store.demoteProfileForJoin, dropLocalForAdoption: store.dropLocalForAdoption,
    mergeRemote: store.mergeRemote, settlePushedStamps: store.settlePushedStamps, showToast: (message) => toasts.push(message),
  });
  return { store, sync };
}

function pair(token: string) {
  const cursor = new Date(Date.now() - 60_000).toISOString();
  window.localStorage.setItem(FAMILY_KEY, JSON.stringify({
    familyId: token, token, deviceId: "d", deviceLabel: "x", lastSyncAt: cursor, lastPushedAt: cursor, lastPushedProfileAt: "",
  }));
}

function blob() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[]; profile: { name: string }; profileUpdatedAt?: string };
}

test("a switch to another family while the old family's pull is in flight takes nothing from the old one", async () => {
  seedLog([{ id: "a", type: "bottle", amount: 90, startedAt: new Date(Date.now() - 3_600_000).toISOString() }]);
  pair("old-tok");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const pulls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const now = new Date().toISOString();
    const auth = String((init?.headers as Record<string, string> | undefined)?.authorization ?? "");
    if (String(url).startsWith("/api/sync/pull")) {
      pulls.push(auth);
      if (auth.includes("old-tok")) {
        await gate;
        return new Response(JSON.stringify({
          activities: [{ id: "old-family-row", payload: { type: "diaper", diaperKind: "dirty", startedAt: now }, updatedAt: now, deleted: false, receivedAt: now }],
          profile: { name: "OtherBaby", birthDate: "2025-01-01", feedingMode: "bottle" }, profileUpdatedAt: now, serverTime: now,
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        activities: [], profile: { name: "Mia", birthDate: "2026-09-01", feedingMode: "mixed" }, profileUpdatedAt: "2026-09-01T00:00:00.000Z", serverTime: now,
      }), { status: 200 });
    }
    if (String(url) === "/api/family/google-recover") return new Response(JSON.stringify({ familyId: "NEW", token: "new-tok", deviceId: "d2" }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, accepted: 0, serverTime: now }), { status: 200 });
  }));

  const { result } = renderHook(() => useBoth());
  await waitFor(() => expect(pulls).toEqual(["Bearer old-tok"]));
  await act(async () => {
    await result.current.sync.googleContinue("cred", "This phone", { discardLocal: true });
  });
  await act(async () => {
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  expect(blob().activities.map((a) => a.id)).not.toContain("old-family-row");
  // The new family's first pull, turned away while the old one held the
  // flag, runs as soon as it lets go — and its baby is the one adopted.
  await waitFor(() => expect(pulls).toContain("Bearer new-tok"));
  await waitFor(() => expect(blob().profile.name).toBe("Mia"));
  expect(blob().profileUpdatedAt).toBe("2026-09-01T00:00:00.000Z");
}, 10_000);

test("a backup merged while a pull is in flight still gets its full re-pull", async () => {
  const old = "2026-01-10T08:00:00.000Z";
  seedLog([{ id: "a", type: "bottle", amount: 90, startedAt: new Date(Date.now() - 3_600_000).toISOString() }]);
  pair("tok");
  const pulls: string[] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const now = new Date().toISOString();
    if (String(url).startsWith("/api/sync/pull")) {
      const since = new URL(String(url), "http://x").searchParams.get("since") ?? "";
      pulls.push(since);
      if (pulls.length === 1) await gate;
      // Only a FULL pull reaches back far enough for the family's tombstone.
      const activities = since === ""
        ? [{ id: "ghost", payload: { type: "diaper", diaperKind: "wet", startedAt: old }, updatedAt: "2026-02-01T08:00:00.000Z", deleted: true, receivedAt: "2026-02-01T08:00:00.000Z" }]
        : [];
      return new Response(JSON.stringify({ activities, profile: null, profileUpdatedAt: null, deviceCount: 2, serverTime: now }), { status: 200 });
    }
    return new Response(JSON.stringify({ accepted: 0, serverTime: now }), { status: 200 });
  }));
  vi.spyOn(window, "confirm").mockReturnValue(true);

  const { result } = renderHook(() => useBoth());
  await waitFor(() => expect(pulls.length).toBe(1));
  // An old backup holding an entry deleted long ago, its tombstone swept here.
  const backup = JSON.stringify({
    profile: { name: "Mia", birthDate: "2026-01-01", feedingMode: "mixed" }, onboardingComplete: true,
    activities: [{ id: "ghost", type: "diaper", diaperKind: "wet", startedAt: old, updatedAt: old }],
  });
  act(() => {
    result.current.store.mergeBackupText(backup, "Merge?", "file");
  });
  expect(result.current.store.activities.map((a) => a.id)).toContain("ghost");
  await act(async () => {
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  await waitFor(() => expect(pulls).toContain(""));
  await waitFor(() => expect(result.current.store.activities.map((a) => a.id)).not.toContain("ghost"));
  expect(blob().activities.filter((a) => !a.deleted).map((a) => a.id)).not.toContain("ghost");
  expect(JSON.parse(window.localStorage.getItem(FAMILY_KEY)!).lastSyncAt).not.toBe("");
}, 10_000);

test("a pull of nothing but a partner's deletion is saved, and not announced as new", async () => {
  seedLog([{ id: "mine", type: "bottle", amount: 90, startedAt: new Date(Date.now() - 3_600_000).toISOString() }]);
  pair("tok");
  const now = new Date().toISOString();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).startsWith("/api/sync/pull")) {
      return new Response(JSON.stringify({
        activities: [{ id: "partner-oops", payload: { type: "diaper", diaperKind: "wet", startedAt: now }, updatedAt: now, deleted: true, receivedAt: now }],
        profile: null, profileUpdatedAt: null, deviceCount: 2, serverTime: now,
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ accepted: 0, serverTime: now }), { status: 200 });
  }));
  const toasts: string[] = [];
  renderHook(() => useBoth(toasts));
  await waitFor(() => expect(blob().activities.find((a) => a.id === "partner-oops")?.deleted).toBe(true));
  expect(toasts.filter((message) => message.startsWith("Synced"))).toEqual([]);
});

// An entry written while this phone's clock ran ten days fast. It must still
// reach the other parent (it is sent like any other), and once the server
// has stored it as "received now" this phone's copy says the same — or it
// would win every conflict against the other parent's later edits, and go
// out again on every push.
test("a fast-clock entry is sent, then takes the server's time", async () => {
  const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
  seedLog([{ id: "fast", type: "bottle", amount: 90, startedAt: new Date(Date.now() - 3_600_000).toISOString(), updatedAt: future }]);
  pair("tok");
  const pushed: string[][] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const now = new Date().toISOString();
    if (String(url).startsWith("/api/sync/pull")) {
      return new Response(JSON.stringify({ activities: [], profile: null, profileUpdatedAt: null, deviceCount: 2, serverTime: now }), { status: 200 });
    }
    if (String(url).startsWith("/api/sync/push")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { activities?: Array<{ id: string }> };
      pushed.push((body.activities ?? []).map((row) => row.id));
      return new Response(JSON.stringify({ accepted: body.activities?.length ?? 0, serverTime: now }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }));

  renderHook(() => useBoth());
  await waitFor(() => expect(pushed.flat()).toContain("fast"), { timeout: 8_000 });
  await waitFor(() => expect(Date.parse(blob().activities.find((a) => a.id === "fast")!.updatedAt!)).toBeLessThanOrEqual(Date.now()));
  expect(blob().activities.find((a) => a.id === "fast")).toMatchObject({ amount: 90 });
}, 12_000);

// The cursor was set while this phone's clock ran fast; the clock has since
// been corrected. Entries logged since sit below the cursor — and used never
// to be sent, while Sync now said all was well.
test("a cursor left ahead by a fast clock does not keep new entries from the partner", async () => {
  const now = Date.now();
  seedLog([{ id: "new", type: "bottle", amount: 90, startedAt: new Date(now - 60_000).toISOString(), updatedAt: new Date(now - 60_000).toISOString() }]);
  const ahead = new Date(now + 5 * 86_400_000).toISOString();
  window.localStorage.setItem(FAMILY_KEY, JSON.stringify({
    familyId: "tok", token: "tok", deviceId: "d", deviceLabel: "x", lastSyncAt: new Date(now - 60_000).toISOString(), lastPushedAt: ahead, lastPushedProfileAt: "",
  }));
  const pushed: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const served = new Date().toISOString();
    if (String(url).startsWith("/api/sync/pull")) {
      return new Response(JSON.stringify({ activities: [], profile: null, profileUpdatedAt: null, deviceCount: 2, serverTime: served }), { status: 200 });
    }
    if (String(url).startsWith("/api/sync/push")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { activities?: Array<{ id: string }> };
      pushed.push(...(body.activities ?? []).map((row) => row.id));
      return new Response(JSON.stringify({ accepted: body.activities?.length ?? 0, serverTime: served }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }));

  renderHook(() => useBoth());
  await waitFor(() => expect(pushed).toContain("new"), { timeout: 8_000 });
  // And the cursor is back on this phone's clock.
  await waitFor(() => expect(JSON.parse(window.localStorage.getItem(FAMILY_KEY)!).lastPushedAt <= new Date().toISOString()).toBe(true));
}, 12_000);
