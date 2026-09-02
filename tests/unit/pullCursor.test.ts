import { describe, expect, it } from "vitest";
import { nextPullCursor } from "@/domain/syncCursor";

// The pull page cursor. Arrival stamps tie — the one-time backfill gave every
// pre-existing row the same one — and a cursor on the stamp alone re-served
// the first page for ever, so a joining phone never received the rest of the
// family's history while "Sync now" reported success.
describe("nextPullCursor", () => {
  it("is the (stamp, id) pair of the last row, with no step back", () => {
    expect(nextPullCursor({ id: "row-1999", updatedAt: "2026-08-01T10:00:00.000Z", receivedAt: "2026-08-30T02:00:00.000Z" }))
      .toEqual({ since: "2026-08-30T02:00:00.000Z", after: "row-1999" });
  });

  it("steps the client stamp back a millisecond for rows from a worker without an arrival clock", () => {
    expect(nextPullCursor({ id: "row", updatedAt: "2026-08-01T10:00:00.000Z" }))
      .toEqual({ since: "2026-08-01T09:59:59.999Z" });
  });

  it("has nothing to say about an empty page or an unreadable stamp", () => {
    expect(nextPullCursor(undefined)).toBeNull();
    expect(nextPullCursor({ id: "row", updatedAt: "nope" })).toBeNull();
  });
});
