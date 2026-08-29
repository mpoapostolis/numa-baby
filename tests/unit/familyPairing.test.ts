import { describe, expect, it } from "vitest";
import { rewoundPushCursor } from "@/domain/familyPairing";

describe("rewoundPushCursor — the Cha fix", () => {
  // The scenario a real family lived: both phones paired, one restores a
  // backup whose entries are dated last week; the push cursor stands at
  // yesterday, so "everything newer than the cursor" skipped all of them —
  // every "Share with partner" retry merged locally and uploaded nothing.
  it("rewinds past the oldest merged stamp so the next push re-sends it", () => {
    const cursor = "2026-08-28T10:00:00.000Z";
    const oldestMerged = "2026-08-20T09:00:00.000Z";
    expect(rewoundPushCursor(cursor, oldestMerged)).toBe("2026-08-20T08:59:59.999Z");
  });

  it("leaves the cursor alone when it is already behind the merge", () => {
    expect(rewoundPushCursor("2026-08-10T00:00:00.000Z", "2026-08-20T09:00:00.000Z")).toBeNull();
  });

  it("does nothing for a fresh pairing or an empty merge", () => {
    // No cursor yet -> everything pushes anyway; no incoming -> nothing to rewind for.
    expect(rewoundPushCursor("", "2026-08-20T09:00:00.000Z")).toBeNull();
    expect(rewoundPushCursor("2026-08-28T10:00:00.000Z", "")).toBeNull();
    expect(rewoundPushCursor("2026-08-28T10:00:00.000Z", "not-a-date")).toBeNull();
  });
});
