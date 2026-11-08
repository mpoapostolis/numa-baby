// Nursing by side, as a daily average — the Insights half of a parent's
// request ("a statistic of how long she nurses on the right and on the left
// each day"; the Timeline shows each day, this shows the usual day).
//
// Its own module because only Insights, a lazy screen, reads it.

import type { DaySummary } from "./daySummary";

export type SideAverage = {
  /** Minutes a day on each side, rounded. */
  left: number;
  right: number;
  /** Sessions logged as both sides, whose split nobody timed. */
  both: number;
  /** How many days the average is over. */
  days: number;
};

/**
 * The week's average minutes a day on each side, over the days that had any
 * nursing — a mixed-feeding day with only bottles is not a day she nursed
 * zero minutes on each side. Today is still being lived, so it counts only
 * while it is the only nursing day, the same rule as Feeds / day.
 * Null when the week has no nursing at all.
 */
export function nursingSideAverage(week: DaySummary[]): SideAverage | null {
  const nursed = week.filter((day) => day.nursingMinutes > 0);
  const complete = nursed.filter((day) => !day.isToday);
  const counted = complete.length > 0 ? complete : nursed;
  if (counted.length === 0) return null;
  const average = (pick: (day: DaySummary) => number) =>
    Math.round(counted.reduce((sum, day) => sum + pick(day), 0) / counted.length);
  return {
    left: average((day) => day.nursingBySide.left),
    right: average((day) => day.nursingBySide.right),
    both: average((day) => day.nursingBySide.both),
    days: counted.length,
  };
}
