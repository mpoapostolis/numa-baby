// The 3am offer.
//
// A second phone is the one thing that makes this app worth twice as much,
// and the moment a parent understands why is not on a Tuesday afternoon in
// Settings. It is at 3am, alone, doing the third feed of the night while
// somebody else sleeps in the next room.
//
// So: offered in the small hours, to a family logging alone, and only once
// the small hours are clearly a habit rather than one bad night. Shown once
// in the life of the app, then never again — an offer that repeats at 3am
// is not an offer, it is nagging.

import { Activity } from "./types";
import { dayKey } from "./daySummary";

/** The hours this is about. 05:00 is when a night stops being the night. */
const SMALL_HOURS_END = 5;

/** Nights with an entry in the small hours before the offer is earned. */
export const NIGHTS_BEFORE_OFFER = 3;

export function isSmallHours(now: number): boolean {
  return new Date(now).getHours() < SMALL_HOURS_END;
}

/**
 * How many distinct nights this family has logged something between midnight
 * and five. Counted over the last fortnight only, so a family that has since
 * found its feet is not offered a fix for a problem it no longer has.
 */
export function nightsLoggedAlone(activities: Activity[], now: number): number {
  const since = now - 14 * 86_400_000;
  const nights = new Set<string>();
  for (const activity of activities) {
    if (activity.deleted) continue;
    const at = new Date(activity.startedAt);
    const moment = at.getTime();
    if (!Number.isFinite(moment) || moment < since || moment > now) continue;
    if (at.getHours() >= SMALL_HOURS_END) continue;
    nights.add(dayKey(at));
  }
  return nights.size;
}

/**
 * Whether to make the offer on this open.
 *
 * @param paired      already sharing the log — there is nothing to offer
 * @param askedBefore this phone has been offered it once already
 */
export function shouldOfferNightHelp(options: {
  activities: Activity[];
  now: number;
  paired: boolean;
  askedBefore: boolean;
}): boolean {
  const { activities, now, paired, askedBefore } = options;
  if (paired || askedBefore || !isSmallHours(now)) return false;
  return nightsLoggedAlone(activities, now) >= NIGHTS_BEFORE_OFFER;
}
