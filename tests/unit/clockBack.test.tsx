/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { STORAGE_KEY, useTrackerStore } from "@/hooks/useTrackerStore";
import { useFamilySync } from "@/hooks/useFamilySync";
import { FAMILY_KEY } from "@/domain/familyPairing";
import { parseStoredData } from "@/domain/validate";
import { Activity } from "@/domain/types";
import { seedLog } from "./appHarness";

// A phone's clock can go back: a flat battery before network time returns, or
// a date set by hand. The future fence used to judge this phone's own log by
// that clock, skipped the last days of it at start-up, and the next save
// erased them for good. A partner's rows were judged by it too, and dropped
// while the pull cursor moved past them.

const DAY = 86_400_000;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function storedIds() {
  return (JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[] }).activities.map((a) => a.id);
}

function renderStore() {
  return renderHook(() => useTrackerStore({ debugMode: false, showToast: () => {}, onNotificationPermission: () => {} }));
}

test.each([
  ["a week back", (now: number) => now - 7 * DAY],
  ["reset to a factory date", () => Date.parse("2016-01-01T00:00:00Z")],
])("a clock gone %s keeps every entry, through start-up and the next save", async (_, wrongClock) => {
  const realNow = Date.now();
  const recent = new Date(realNow - 3_600_000).toISOString();
  seedLog([
    { id: "old", type: "bottle", amount: 90, startedAt: new Date(realNow - 10 * DAY).toISOString() },
    { id: "yesterday", type: "bottle", amount: 120, startedAt: new Date(realNow - DAY).toISOString() },
    { id: "today", type: "diaper", diaperKind: "wet", startedAt: recent, updatedAt: recent },
  ]);
  vi.useFakeTimers({ now: wrongClock(realNow), toFake: ["Date"] });

  const { result } = renderStore();
  await waitFor(() => expect(result.current.bootState).toBe("ready"));
  expect(result.current.activities.map((a) => a.id).sort()).toEqual(["old", "today", "yesterday"]);
  expect(result.current.recoveredNotice).toBeNull();

  act(() => {
    result.current.addActivity({ id: "new", type: "bottle", amount: 60, startedAt: new Date().toISOString() }, "Saved");
  });
  expect(storedIds().sort()).toEqual(["new", "old", "today", "yesterday"]);
  // Nor is a stamp rewritten to the wrong "now": the next push and every
  // merge still see when the entry was really written.
  const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[] };
  expect(stored.activities.find((a) => a.id === "today")?.updatedAt).toBe(recent);
});

test("a file or a link is still fenced by this phone's clock; its own log is not", () => {
  const farAhead = new Date(Date.now() + 365 * DAY).toISOString();
  const blob = JSON.stringify({
    profile: { name: "Mia", birthDate: "2026-09-01", feedingMode: "mixed" },
    activities: [
      { id: "now", type: "bottle", amount: 90, startedAt: new Date().toISOString() },
      { id: "ahead", type: "bottle", amount: 90, startedAt: farAhead },
    ],
  });
  const imported = parseStoredData(blob);
  expect(imported.activities.map((a) => a.id)).toEqual(["now"]);
  expect(imported.droppedActivities).toBe(1);
  const own = parseStoredData(blob, { ownLog: true });
  expect(own.activities.map((a) => a.id)).toEqual(["now", "ahead"]);
  expect(own.droppedActivities).toBe(0);
});

test("a partner's rows are judged by the server's clock, not by a phone clock gone back", async () => {
  const realNow = Date.now();
  const serverTime = new Date(realNow).toISOString();
  seedLog([{ id: "mine", type: "bottle", amount: 90, startedAt: new Date(realNow - 10 * DAY).toISOString() }]);
  window.localStorage.setItem(FAMILY_KEY, JSON.stringify({
    familyId: "f", token: "tok", deviceId: "d", deviceLabel: "x",
    lastSyncAt: new Date(realNow - 8 * DAY).toISOString(), lastPushedAt: new Date(realNow - 8 * DAY).toISOString(), lastPushedProfileAt: "",
  }));
  const partnerFeed = new Date(realNow - 3_600_000).toISOString();
  const fabricated = new Date(realNow + 30 * DAY).toISOString();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).startsWith("/api/sync/pull")) {
      return new Response(JSON.stringify({
        activities: [
          { id: "partner-feed", payload: { type: "bottle", amount: 120, startedAt: partnerFeed }, updatedAt: partnerFeed, deleted: false, receivedAt: serverTime },
          { id: "fabricated", payload: { type: "bottle", amount: 120, startedAt: fabricated }, updatedAt: serverTime, deleted: false, receivedAt: serverTime },
        ],
        profile: null, profileUpdatedAt: null, deviceCount: 2, serverTime,
      }), { status: 200 });
    }
    return new Response(JSON.stringify({ accepted: 0, serverTime }), { status: 200 });
  }));
  vi.useFakeTimers({ now: realNow - 7 * DAY, toFake: ["Date"] });

  const { result } = renderHook(() => {
    const store = useTrackerStore({ debugMode: false, showToast: () => {}, onNotificationPermission: () => {} });
    useFamilySync({
      debugMode: false, bootState: store.bootState, persistVersion: store.persistVersion,
      backfillVersion: store.backfillVersion, backfillOldestAt: store.backfillOldestAt,
      readPersisted: store.readPersisted, stampProfileForSync: store.stampProfileForSync,
      demoteProfileForJoin: store.demoteProfileForJoin, dropLocalForAdoption: store.dropLocalForAdoption,
      mergeRemote: store.mergeRemote, showToast: () => {},
    });
    return store;
  });
  await waitFor(() => expect(result.current.activities.map((a) => a.id)).toContain("partner-feed"));
  // Still fenced, by the one clock in the family a battery cannot reset.
  expect(storedIds()).not.toContain("fabricated");
  const kept = (JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[] }).activities
    .find((a) => a.id === "partner-feed");
  // And its write stamp is left alone: it is not ahead of the server.
  expect(kept?.updatedAt).toBe(partnerFeed);
});
