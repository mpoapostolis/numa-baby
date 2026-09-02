import { describe, expect, it } from "vitest";
import { NIGHTS_BEFORE_OFFER, isSmallHours, nightsLoggedAlone, shouldOfferNightHelp } from "@/domain/nightAlone";
import { Activity } from "@/domain/types";

// The offer of a second phone, made at the hour it makes sense and never
// twice.

const feed = (id: string, at: Date): Activity => ({ id, type: "bottle", startedAt: at.toISOString(), amount: 90, milkType: "formula" });
const night = (day: number, hour = 3) => new Date(2026, 7, day, hour, 20);
const NOW = new Date(2026, 7, 26, 3, 40).getTime();

describe("shouldOfferNightHelp", () => {
  const threeNights = [feed("a", night(24)), feed("b", night(25)), feed("c", night(26))];

  it("waits for the small hours to be a habit, then offers once", () => {
    expect(nightsLoggedAlone(threeNights, NOW)).toBe(NIGHTS_BEFORE_OFFER);
    expect(shouldOfferNightHelp({ activities: threeNights, now: NOW, paired: false, askedBefore: false })).toBe(true);
    expect(shouldOfferNightHelp({ activities: threeNights.slice(1), now: NOW, paired: false, askedBefore: false })).toBe(false);
  });

  it("says nothing in daylight, to a family already sharing, or to one already asked", () => {
    const day = new Date(2026, 7, 26, 14, 0).getTime();
    expect(isSmallHours(day)).toBe(false);
    expect(shouldOfferNightHelp({ activities: threeNights, now: day, paired: false, askedBefore: false })).toBe(false);
    expect(shouldOfferNightHelp({ activities: threeNights, now: NOW, paired: true, askedBefore: false })).toBe(false);
    expect(shouldOfferNightHelp({ activities: threeNights, now: NOW, paired: false, askedBefore: true })).toBe(false);
  });

  it("counts nights, not entries, and only recent ones", () => {
    const oneBusyNight = [feed("a", night(26, 1)), feed("b", night(26, 2)), feed("c", night(26, 4))];
    expect(nightsLoggedAlone(oneBusyNight, NOW)).toBe(1);
    // A fortnight ago is a family that has since found its feet.
    const old = [feed("a", night(1)), feed("b", night(2)), feed("c", night(3))];
    expect(nightsLoggedAlone(old, NOW)).toBe(0);
    // Undone entries are not nights.
    expect(nightsLoggedAlone(threeNights.map((a) => ({ ...a, deleted: true as const })), NOW)).toBe(0);
    // Daytime feeds are not nights either.
    expect(nightsLoggedAlone([feed("a", new Date(2026, 7, 25, 11, 0))], NOW)).toBe(0);
  });
});
