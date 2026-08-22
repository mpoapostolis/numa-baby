import { useMemo } from "react";
import { summarizeDay } from "../domain/daySummary";
import { ageInMonths, isSameDay, median } from "../domain/time";
import { Activity, Profile } from "../domain/types";

// Every derived figure the screens read, split into two memos: one pass over
// the activities for everything that only changes when the data changes, and a
// second for the values that also roll over with the minute clock (today's
// totals, the weekly chart, the forecast windows). The expressions are ported
// verbatim so every number matches what the app showed before the extraction.

export type ActivityStats = ReturnType<typeof useActivityStats>;

export function useActivityStats(activities: Activity[], profile: Profile, minuteClock: number) {
  const base = useMemo(() => {
    const sortedActivities = [...activities].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

    // One newest-first pass collects every "last/active" value and the capped
    // source lists the pattern maths read from.
    let lastFeed: Activity | undefined;
    let lastBottle: Activity | undefined;
    let activeNursing: Activity | undefined;
    const activeTimers: Activity[] = [];
    const feedTimes: number[] = [];
    const growthByDate: Activity[] = [];
    for (const activity of sortedActivities) {
      const isFeed = activity.type === "bottle" || activity.type === "nursing";
      if (isFeed) {
        if (!lastFeed) lastFeed = activity;
        if (feedTimes.length < 30) feedTimes.push(new Date(activity.startedAt).getTime());
      }
      if (!lastBottle && activity.type === "bottle" && activity.amount && activity.milkType) {
        lastBottle = activity;
      }
      if ((activity.type === "nursing" || activity.type === "sleep") && !activity.endedAt) {
        // Every open session, not just nursing — a sleep timer left running by
        // an older version must stay visible and individually stoppable.
        activeTimers.push(activity);
        if (!activeNursing && activity.type === "nursing") activeNursing = activity;
      }
      if (activity.type === "growth" && activity.weightGrams) growthByDate.push(activity);
    }

    const growthEntries = growthByDate.sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
    const latestGrowth = growthEntries[growthEntries.length - 1];
    const previousGrowth = growthEntries[growthEntries.length - 2];
    const weightChange =
      latestGrowth?.weightGrams && previousGrowth?.weightGrams
        ? latestGrowth.weightGrams - previousGrowth.weightGrams
        : 0;

    feedTimes.sort((a, b) => a - b);
    const feedingGaps = feedTimes
      .slice(1)
      .map((time, index) => Math.round((time - feedTimes[index]) / 60_000))
      .filter((minutes) => minutes > 20 && minutes < 480);
    const typicalGap = median(feedingGaps);

    const feedPatternReady = feedingGaps.length >= 3 && Boolean(lastFeed);
    const feedSpread = feedPatternReady
      ? Math.max(15, Math.min(45, median(feedingGaps.map((gap) => Math.abs(gap - typicalGap)))))
      : 20;
    const nextFeedAt = feedPatternReady && lastFeed
      ? new Date(lastFeed.startedAt).getTime() + typicalGap * 60_000
      : null;

    return {
      sortedActivities,
      lastFeed,
      lastBottle,
      activeNursing,
      activeTimers,
      growthEntries,
      latestGrowth,
      previousGrowth,
      weightChange,
      feedingGaps,
      typicalGap,
      feedPatternReady,
      feedSpread,
      nextFeedAt,
    };
  }, [activities]);

  const timeSensitive = useMemo(() => {
    const { sortedActivities, nextFeedAt, feedSpread } = base;
    // Derived from minuteClock, not a render-time `new Date()`, so every figure
    // rolls over together at midnight while the app stays open.
    const todayActivities = sortedActivities.filter((activity) =>
      isSameDay(activity.startedAt, new Date(minuteClock)),
    );
    const feedsToday = todayActivities.filter(
      (activity) => activity.type === "bottle" || activity.type === "nursing",
    );
    const bottleMlToday = feedsToday.reduce((sum, activity) => sum + (activity.amount ?? 0), 0);
    const diapersToday = todayActivities.filter((activity) => activity.type === "diaper").length;

    // Suppress a predicted clock range once it is entirely in the past — a card
    // reading "14:05–14:45" at 17:00 presents history as a forecast.
    const feedWindowPassed = nextFeedAt !== null && nextFeedAt + feedSpread * 60_000 < minuteClock;

    const weekly = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(minuteClock);
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const dayActivities = sortedActivities.filter((activity) => isSameDay(activity.startedAt, date));
      const feeds = dayActivities.filter(
        (activity) => activity.type === "bottle" || activity.type === "nursing",
      );
      return {
        date,
        feeds,
        ml: feeds.reduce((sum, activity) => sum + (activity.amount ?? 0), 0),
        diapers: dayActivities.filter((activity) => activity.type === "diaper").length,
        burps: dayActivities.filter((activity) => activity.type === "burp").length,
      };
    });
    const maxMl = Math.max(...weekly.map((day) => day.ml), 1);

    // Average over days actually tracked, not a fixed 7 — a two-day-old install
    // showing "Feeds / day: 0" beside "3 feeds today" contradicts itself.
    const oldestActivity = sortedActivities[sortedActivities.length - 1];
    const trackedDays = oldestActivity
      ? Math.max(1, Math.min(7, Math.floor((minuteClock - new Date(oldestActivity.startedAt).getTime()) / 86_400_000) + 1))
      : 0;
    const averageFeeds = trackedDays > 0
      ? Math.round((weekly.reduce((sum, day) => sum + day.feeds.length, 0) / trackedDays) * 10) / 10
      : null;

    // The full breakdown every recap quotes — one shared source so Today,
    // Timeline and Insights can never disagree about a number.
    const today = summarizeDay(sortedActivities, new Date(minuteClock), minuteClock);

    return {
      today,
      todayActivities,
      feedsToday,
      bottleMlToday,
      diapersToday,
      feedWindowPassed,
      weekly,
      maxMl,
      trackedDays,
      averageFeeds,
    };
  }, [base, minuteClock]);

  const babyAgeMonths = ageInMonths(profile.birthDate);

  return { ...base, ...timeSensitive, babyAgeMonths };
}
