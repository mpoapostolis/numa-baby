import { describe, expect, it } from "vitest";
import { DISMISS_DAYS, MIN_FEEDS, reminderNudge } from "../../src/domain/reminderNudge";
import { REMINDER_COPY } from "../../src/components/reminderCopy";

const NOW = Date.parse("2026-09-03T12:00:00.000Z");
const DAY = 24 * 60 * 60_000;

const ready = {
  pushReady: true,
  permission: "default" as NotificationPermission,
  remindersOn: false,
  feeds: MIN_FEEDS,
  dismissedAt: null,
};

describe("when to mention that reminders survive a closed app", () => {
  it("offers it to someone with a feeding rhythm and no reminders on", () => {
    expect(reminderNudge(ready, NOW)).toBe("ask");
  });

  it("says nothing where it would not work", () => {
    // A browser without push, or a deployment whose key route answered null:
    // the headline would be a promise the app cannot keep.
    expect(reminderNudge({ ...ready, pushReady: false }, NOW)).toBeNull();
    // Still checking. Better silent than wrong for a moment.
    expect(reminderNudge({ ...ready, pushReady: null }, NOW)).toBeNull();
    expect(reminderNudge({ ...ready, permission: "unsupported" }, NOW)).toBeNull();
  });

  it("does not offer a button that cannot do anything", () => {
    // The browser will not ask a second time after a refusal, so this would
    // be a button that visibly does nothing.
    expect(reminderNudge({ ...ready, permission: "denied" }, NOW)).toBeNull();
  });

  it("says nothing to someone who already has them on", () => {
    expect(reminderNudge({ ...ready, remindersOn: true }, NOW)).toBeNull();
    expect(reminderNudge({ ...ready, remindersOn: true, permission: "granted" }, NOW)).toBeNull();
  });

  it("waits for a rhythm — a reminder counts from the last feed", () => {
    expect(reminderNudge({ ...ready, feeds: MIN_FEEDS - 1 }, NOW)).toBeNull();
    expect(reminderNudge({ ...ready, feeds: 0 }, NOW)).toBeNull();
    expect(reminderNudge({ ...ready, feeds: MIN_FEEDS }, NOW)).not.toBeNull();
  });

  it("drops the permission warning once permission exists", () => {
    expect(reminderNudge({ ...ready, permission: "granted" }, NOW)).toBe("granted");
    // Nothing to agree to, so the wording must not warn about being asked.
    expect(REMINDER_COPY.granted.body).not.toMatch(/will ask/i);
    expect(REMINDER_COPY.ask.body).toMatch(/allow notifications/i);
  });

  it("honours 'not now' for a month, then asks once more", () => {
    const yesterday = new Date(NOW - DAY).toISOString();
    expect(reminderNudge({ ...ready, dismissedAt: yesterday }, NOW)).toBeNull();

    const longAgo = new Date(NOW - (DISMISS_DAYS + 1) * DAY).toISOString();
    expect(reminderNudge({ ...ready, dismissedAt: longAgo }, NOW)).not.toBeNull();
  });

  it("is not silenced by a dismissal stamp it cannot read", () => {
    // A corrupted stamp must not mean "never show this again"; it means the
    // app knows nothing about a dismissal, which is where it started.
    expect(reminderNudge({ ...ready, dismissedAt: "not a date" }, NOW)).not.toBeNull();
  });
});
