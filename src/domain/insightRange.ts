// How far back Insights looks: 7 days, 30 days, 3 months or a year.
//
// Asked for from the feedback box: "have the option of customizing it, like
// if we only want to see 7 days, 5 days, 1 month, year". The week stays the
// default, and the choice is this phone's own, like the trend's category.
//
// A year is 365 bars nobody can read, so the long ranges are drawn as their
// average day per week (3 months) or per month (a year). An average day, not
// a total: a month of 31 days must not out-tower one of 28, and a week the
// app was not opened on must not read as a week she did not eat.
//
// Its own module because only Insights, a lazy screen, reads it.

import type { DaySummary } from "./daySummary";
import { hasRoutineCare } from "./daySummary";

export type InsightRange = "7d" | "30d" | "3m" | "1y";
export const INSIGHT_RANGES: readonly InsightRange[] = ["7d", "30d", "3m", "1y"];

const KEY = "numalog-insights-range-v1";

export function rememberedRange(): InsightRange {
  try {
    const stored = window.localStorage.getItem(KEY);
    return INSIGHT_RANGES.includes(stored as InsightRange) ? (stored as InsightRange) : "7d";
  } catch {
    return "7d";
  }
}

export function rememberRange(range: InsightRange) {
  try {
    window.localStorage.setItem(KEY, range);
  } catch {
    // Remembering is a courtesy; the week again is no harm.
  }
}

/** How many days, ending today, the range covers. A year is the twelve
    calendar months ending with this one, so its first bar is a whole month;
    three months is thirteen whole weeks. */
export function rangeDayCount(range: InsightRange, now: number): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "3m") return 91;
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  const start = new Date(today.getFullYear(), today.getMonth() - 11, 1, 12);
  return Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;
}

/** Bars by day, by week or by month. */
export function rangeGrain(range: InsightRange): "day" | "week" | "month" {
  return range === "3m" ? "week" : range === "1y" ? "month" : "day";
}

/** The days a bar is drawn from, oldest first. */
export type DayGroup = { at: number; days: DaySummary[] };

/** Days grouped for drawing. Weeks are counted back from today, so the last
    bar always ends today; a first week cut short by where the record starts
    is drawn from the days it has. */
export function groupDays(days: DaySummary[], grain: "day" | "week" | "month"): DayGroup[] {
  if (grain === "day") return days.map((day) => ({ at: day.date.getTime(), days: [day] }));
  const groups: DayGroup[] = [];
  if (grain === "week") {
    for (let end = days.length; end > 0; end -= 7) {
      const chunk = days.slice(Math.max(0, end - 7), end);
      groups.unshift({ at: chunk[0].date.getTime(), days: chunk });
    }
    return groups;
  }
  for (const day of days) {
    const last = groups[groups.length - 1];
    const lastDay = last?.days[0].date;
    if (last && lastDay!.getMonth() === day.date.getMonth() && lastDay!.getFullYear() === day.date.getFullYear()) {
      last.days.push(day);
    } else {
      groups.push({ at: day.date.getTime(), days: [day] });
    }
  }
  return groups;
}

/** The days an average is fair over: the logged ones (`logged` decides what
    counts — any care, or a bottle), and today only while it is the only one,
    because its morning is not a whole day. */
export function countedDays(days: DaySummary[], logged: (day: DaySummary) => boolean = hasRoutineCare): DaySummary[] {
  const loggedDays = days.filter(logged);
  const complete = loggedDays.filter((day) => !day.isToday);
  return complete.length > 0 ? complete : loggedDays;
}

/** The average day of a group, for one figure; null when nothing counted. */
export function averageDay(
  days: DaySummary[],
  value: (day: DaySummary) => number,
  logged: (day: DaySummary) => boolean = hasRoutineCare,
): number | null {
  const counted = countedDays(days, logged);
  if (counted.length === 0) return null;
  return counted.reduce((sum, day) => sum + value(day), 0) / counted.length;
}
