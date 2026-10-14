// The two kinds of entry that are in the log but are not care — a month's
// page and a vaccination — as far as the boot path needs to know them: what
// to leave out of every total, how many months have a page, and which month
// the family is living in now. The rest belongs to their lazy sheets
// (months.ts, vaccines.ts).

import type { Activity } from "./types";

/** Monthly through the second year, as the parties are. */
export const MONTHS_KEPT = 24;

/**
 * The log without what is not care: a month's note and photo, a vaccination.
 * Every total, average, forecast, recap and "days tracked" is computed over
 * this — a month note written for month 1 must not stretch "feeds per day"
 * back to the first week, and a planned vaccine must not make an empty day
 * look logged.
 */
export function careEntries(activities: Activity[]): Activity[] {
  return activities.filter((activity) => activity.type !== "month" && activity.type !== "vaccine");
}

/**
 * How many month-birthdays a baby born on `birthDate` has had by `now`: 0
 * before the first, 4 from the fourth until the fifth. Calendar months,
 * clamped as the parties and the months album clamp them — born on the 31st,
 * a month-birthday in a 30-day month is on the 30th. Not capped: past the
 * second year the album has no page for the month, and the caller says so.
 */
export function monthsReached(birthDate: string, now: number): number | null {
  const birth = new Date(`${birthDate.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(birth.getTime())) return null;
  const at = new Date(now);
  let months = (at.getFullYear() - birth.getFullYear()) * 12 + at.getMonth() - birth.getMonth();
  const monthBirthday = Math.min(birth.getDate(), new Date(at.getFullYear(), at.getMonth() + 1, 0).getDate());
  if (at.getDate() < monthBirthday) months -= 1;
  return Math.max(0, months);
}
