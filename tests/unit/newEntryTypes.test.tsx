/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY, useTrackerStore } from "@/hooks/useTrackerStore";
import { parseStoredData } from "@/domain/validate";
import { careEntries } from "@/domain/keepsakes";
import { monthEntryId } from "@/domain/months";
import { Activity } from "@/domain/types";

// Two kinds of entry that are not care: a month's note and photo, and a
// vaccination — given, or planned for a date that has not come yet. Both
// live in the log so they sync, back up and merge like everything else, and
// both are kept out of every total, average and forecast.

const NOW = new Date().toISOString();
const PHOTO = "3f6c1d2e-9a4b-4c1d-8e2f-112233445566";

function stored(activities: Activity[]) {
  return JSON.stringify({
    activities,
    profile: { name: "Mia", birthDate: "2026-06-15", feedingMode: "mixed" },
    onboardingComplete: true,
  });
}

describe("what a month or a vaccine entry may hold", () => {
  it("keeps a month's note and photo", () => {
    const month: Activity = { id: monthEntryId(3), type: "month", month: 3, startedAt: NOW, note: "First laugh", photo: PHOTO };
    expect(parseStoredData(stored([month])).activities).toEqual([month]);
  });

  it("refuses a month that does not exist, and a photo reference that is not one", () => {
    const data = parseStoredData(stored([
      { id: "m0", type: "month", month: 0, startedAt: NOW },
      { id: "m25", type: "month", month: 25, startedAt: NOW },
      { id: "d1", type: "diaper", diaperKind: "dirty", startedAt: NOW, photo: "../../secrets" },
    ]));
    expect(data.activities).toEqual([]);
  });

  it("keeps a planned vaccine, its date in a field of its own", () => {
    // Entries dated more than two days ahead are thrown away on load — by
    // this build and by older ones — so a planned vaccine is stamped when it
    // was planned and carries the appointment as `due`.
    const planned: Activity = { id: "v1", type: "vaccine", vaccine: "Pentavalent", dose: "2nd dose", place: "public", planned: true, due: "2027-02-01", startedAt: NOW };
    expect(parseStoredData(stored([planned])).activities).toEqual([planned]);
    expect(parseStoredData(stored([{ ...planned, due: "next week" } as Activity])).activities).toEqual([]);
  });

  it("does not drop a vaccine from a later build that knows a third kind of place", () => {
    const given = { id: "v2", type: "vaccine", vaccine: "BCG", place: "mobile-clinic", startedAt: NOW } as unknown as Activity;
    expect(parseStoredData(stored([given])).activities).toHaveLength(1);
  });
});

describe("care, and what is not care", () => {
  it("leaves months and vaccines out of everything that counts care", () => {
    const entries: Activity[] = [
      { id: "b", type: "bottle", amount: 90, startedAt: NOW },
      { id: monthEntryId(1), type: "month", month: 1, startedAt: NOW },
      { id: "v", type: "vaccine", vaccine: "BCG", startedAt: NOW },
    ];
    expect(careEntries(entries).map((a) => a.id)).toEqual(["b"]);
  });
});

describe("a month has one entry, whichever phone wrote it", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  async function store() {
    window.localStorage.setItem(STORAGE_KEY, stored([]));
    const hook = renderHook(() =>
      useTrackerStore({ debugMode: false, showToast: () => {}, onNotificationPermission: () => {} }),
    );
    await waitFor(() => expect(hook.result.current.bootState).toBe("ready"));
    return hook;
  }

  it("writing month 3 twice keeps one entry with the latest words", async () => {
    const { result } = await store();
    act(() => {
      result.current.upsertActivity({ id: monthEntryId(3), type: "month", month: 3, startedAt: NOW, note: "Rolled over" });
    });
    act(() => {
      result.current.upsertActivity({ id: monthEntryId(3), type: "month", month: 3, startedAt: NOW, note: "Rolled over twice" });
    });
    const rows = (JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[] }).activities;
    expect(rows.filter((a) => a.id === monthEntryId(3))).toHaveLength(1);
    expect(rows[0].note).toBe("Rolled over twice");
  });

  it("writing a month that was deleted brings the entry back rather than adding a second", async () => {
    const { result } = await store();
    const month: Activity = { id: monthEntryId(2), type: "month", month: 2, startedAt: NOW, note: "Smiled" };
    act(() => {
      result.current.upsertActivity(month);
    });
    act(() => {
      result.current.removeActivity(month);
    });
    act(() => {
      result.current.upsertActivity({ ...month, note: "Smiled again" });
    });
    const rows = (JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[] }).activities;
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted).toBeUndefined();
    expect(rows[0].note).toBe("Smiled again");
  });
});
