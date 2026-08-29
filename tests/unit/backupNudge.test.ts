// The nudge that asks about a backup. Mostly tested on when it must stay
// QUIET: a card that appears when it is not wanted is a card that gets
// dismissed on sight, and then it is not there on the day it matters.

import { describe, expect, it } from "vitest";
import {
  BACKUP_FRESH_DAYS,
  BackupInput,
  DISMISS_DAYS,
  MIN_ENTRIES,
  backupNudge,
} from "@/domain/backupNudge";

const NOW = Date.parse("2026-08-29T12:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const base: BackupInput = {
  entries: 200,
  lastBackupAt: null,
  synced: false,
  storagePersisted: null,
  dismissedAt: null,
};

describe("when it stays quiet", () => {
  it("says nothing to someone who has barely started", () => {
    expect(backupNudge({ ...base, entries: MIN_ENTRIES - 1 }, NOW)).toBeNull();
  });

  it("says nothing when Family Sync already holds a copy", () => {
    expect(backupNudge({ ...base, synced: true }, NOW)).toBeNull();
    // Even when the browser is threatening to evict — the log is elsewhere.
    expect(backupNudge({ ...base, synced: true, storagePersisted: false }, NOW)).toBeNull();
  });

  it("says nothing to someone who has just backed up", () => {
    expect(backupNudge({ ...base, lastBackupAt: daysAgo(BACKUP_FRESH_DAYS - 1) }, NOW)).toBeNull();
  });

  it("takes no for an answer, for a fortnight", () => {
    expect(backupNudge({ ...base, dismissedAt: daysAgo(DISMISS_DAYS - 1) }, NOW)).toBeNull();
    expect(backupNudge({ ...base, dismissedAt: daysAgo(DISMISS_DAYS + 1) }, NOW)).not.toBeNull();
  });

  it("ignores a stamp it cannot read rather than staying silent for ever", () => {
    // A corrupt date must not become a permanent excuse not to ask.
    expect(backupNudge({ ...base, dismissedAt: "not a date" }, NOW)).not.toBeNull();
    expect(backupNudge({ ...base, lastBackupAt: "" }, NOW)).not.toBeNull();
  });
});

describe("when it speaks", () => {
  it("counts what is at stake for someone who has never backed up", () => {
    const nudge = backupNudge({ ...base, entries: 412 }, NOW);
    expect(nudge?.tone).toBe("info");
    expect(nudge?.headline).toContain("412");
    expect(nudge?.body).toContain("no copy of them anywhere else");
  });

  it("says something different once a backup has gone stale", () => {
    const nudge = backupNudge({ ...base, lastBackupAt: daysAgo(BACKUP_FRESH_DAYS + 5) }, NOW);
    expect(nudge?.body).toContain("over a month old");
  });

  it("stops being gentle when the browser says it may evict the data", () => {
    const nudge = backupNudge({ ...base, storagePersisted: false }, NOW);
    expect(nudge?.tone).toBe("warn");
    expect(nudge?.headline).toContain("may delete");
  });

  it("stays gentle when the browser has promised to keep it", () => {
    expect(backupNudge({ ...base, storagePersisted: true }, NOW)?.tone).toBe("info");
  });
});
