// Ships with this lazy chunk, not the app shell — the budget rule.
import "../styles/screens/timeline.css";
import { useMemo } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ItemGroup, ItemSeparator } from "../components/ui/item";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { ActivityRow } from "../components/ActivityRow";
import { DayRecapLine } from "../components/DayRecap";
import { EmptyState } from "../components/EmptyState";
import { detailReadsClock } from "../domain/activityDisplay";
import { bucketByDay, dayKey, summarizeDay } from "../domain/daySummary";
import { formatTimelineDay } from "../domain/time";
import { isTimedType } from "../domain/timers";
import { Activity, ActivityType } from "../domain/types";
import { t } from "../i18n";

/** The chips in the filter row, in order. */
const FILTER_CHIPS = ["all", "photos", "bottle", "nursing", "pump", "diaper", "burp", "tummy", "sleep", "solid", "medicine", "growth", "health"] as const;
type FilterChip = (typeof FILTER_CHIPS)[number];

// Spelled out rather than capitalised from the type name, for the same
// reason as the feeding modes: a word assembled at runtime is a word the
// dictionary cannot be checked against. Whole sentences for the same reason —
// keyed by chip, so adding a chip cannot forget its words.
const FILTER_LABEL: Record<FilterChip, string> = {
  all: "All",
  photos: "Photos",
  bottle: "Bottle",
  nursing: "Nursing",
  pump: "Pumping",
  diaper: "Diaper",
  burp: "Burp",
  tummy: "Tummy time",
  sleep: "Sleep",
  solid: "Solids",
  medicine: "Medicine",
  growth: "Growth",
  health: "Health",
};

const FILTER_ARIA: Record<FilterChip, string> = {
  all: "Show all logs",
  photos: "Show entries with a photo",
  bottle: "Show bottle logs",
  nursing: "Show nursing logs",
  pump: "Show pumping logs",
  diaper: "Show diaper logs",
  burp: "Show burp logs",
  tummy: "Show tummy time logs",
  sleep: "Show sleep logs",
  solid: "Show solid logs",
  medicine: "Show medicine logs",
  growth: "Show growth logs",
  health: "Show health logs",
};

const FILTER_EMPTY: Partial<Record<TimelineFilter, string>> = {
  photos: "No photos yet.",
  bottle: "No bottle entries yet.",
  nursing: "No nursing entries yet.",
  pump: "No pump entries yet.",
  diaper: "No diaper entries yet.",
  burp: "No burp entries yet.",
  tummy: "No tummy entries yet.",
  sleep: "No sleep entries yet.",
  solid: "No solid entries yet.",
  medicine: "No medicine entries yet.",
  growth: "No growth entries yet.",
  health: "No health entries yet.",
};

/** What the timeline says when the chosen filter has nothing in it. */
function emptyFilterText(filter: TimelineFilter): string {
  const sentence = FILTER_EMPTY[filter];
  return sentence ? t(sentence) : t("No {what} entries yet.", { what: filter });
}

/** Every entry, one kind, or — asked for alongside nappy photos — the
    entries that have a photo, to find the one for the doctor again. */
export type TimelineFilter = "all" | "photos" | ActivityType;

type TimelineScreenProps = {
  activities: Activity[];
  minuteClock: number;
  filter: TimelineFilter;
  limit: number;
  onFilterChange: (filter: TimelineFilter) => void;
  onShowMore: () => void;
  onEdit: (activity: Activity) => void;
};

export default function TimelineScreen({
  activities,
  minuteClock,
  filter,
  limit,
  onFilterChange,
  onShowMore,
  onEdit,
}: TimelineScreenProps) {
  const filteredTimeline = useMemo(
    () => activities.filter((activity) => filter === "all" || (filter === "photos" ? Boolean(activity.photo) : activity.type === filter)),
    [activities, filter],
  );
  const timelineGroups = useMemo(() => {
    const groups = new Map<string, Activity[]>();
    filteredTimeline.slice(0, limit).forEach((activity) => {
      const date = new Date(activity.startedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const current = groups.get(key) ?? [];
      current.push(activity);
      groups.set(key, current);
    });
    return [...groups.values()];
  }, [filteredTimeline, limit]);

  // The clock matters to a day's totals only while a timer is running (it
  // clamps the open span). Without one, a day's numbers are the same at
  // 03:14 as at 03:15 — so the clock these memos see moves once a day, and
  // the per-minute recompute (all of history, for every visible day) goes.
  const hasOpenTimer = useMemo(
    () => activities.some((activity) => !activity.endedAt && isTimedType(activity.type)),
    [activities],
  );
  const summaryClock = hasOpenTimer ? minuteClock : new Date(minuteClock).setHours(0, 0, 0, 0);
  // Totals always describe the whole day, never the current filter — otherwise
  // "2 feeds" would quietly mean "2 shown". Bucketed once per data change, so
  // each visible day is summarized over its own entries, not the whole log.
  const buckets = useMemo(() => bucketByDay(activities, summaryClock), [activities, summaryClock]);
  const daySummaries = useMemo(
    () => timelineGroups.map((group) => {
      const day = new Date(group[0].startedAt);
      return summarizeDay(buckets.get(dayKey(day)) ?? [], day, summaryClock);
    }),
    [timelineGroups, buckets, summaryClock],
  );

  return (
    <section className="screen timeline-screen" aria-labelledby="timeline-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("The full picture")}</p>
          <h1 id="timeline-heading">{t("Timeline")}</h1>
        </div>
        <Badge variant="outline" className="count-badge"><span aria-live="polite">{filteredTimeline.length === 1 ? t("1 entry") : t("{n} entries", { n: filteredTimeline.length })}</span></Badge>
      </div>
      <div className="timeline-controls">
        <ToggleGroup
          type="single"
          value={filter}
          className="filter-row"
          aria-label={t("Filter timeline")}
          onValueChange={(value) => {
            if (!value) return;
            onFilterChange(value as TimelineFilter);
          }}
        >
          {FILTER_CHIPS.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              aria-label={t(FILTER_ARIA[option])}
            >
              {t(FILTER_LABEL[option])}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {filteredTimeline.length > 0 && (
          <div className="timeline-date"><span>{t("Latest first")}</span><span>{t("Open any log to correct its details")}</span></div>
        )}
      </div>
      <div className="timeline-groups">
        {timelineGroups.map((group, groupIndex) => (
          <section className="timeline-day" key={new Date(group[0].startedAt).toDateString()}>
            <div className="timeline-day-heading">
              <h2>{formatTimelineDay(group[0].startedAt)}</h2>
              <span>{group.length === 1 ? t("1 entry") : t("{n} entries", { n: group.length })}</span>
            </div>
            {/* The day's totals sit below the sticky heading, not inside it —
                a two-line sticky bar clips under the app header. */}
            <DayRecapLine summary={daySummaries[groupIndex]} />
            <Card size="sm" className="activity-list timeline-list">
              <CardContent className="activity-list-content">
                <ItemGroup>
                  {group.map((activity, index) => (
                    <div role="listitem" key={activity.id}>
                      {index > 0 && <ItemSeparator />}
                      <ActivityRow activity={activity} onEdit={onEdit} now={detailReadsClock(activity) ? minuteClock : undefined} />
                    </div>
                  ))}
                </ItemGroup>
              </CardContent>
            </Card>
          </section>
        ))}
        {!filteredTimeline.length && (
          <Card size="sm" className="activity-list timeline-list">
            <CardContent className="activity-list-content">
              {activities.length === 0 ? (
                <EmptyState text={t("Nothing logged yet — your day builds here from the Today screen.")} />
              ) : (
                <>
                  <EmptyState text={emptyFilterText(filter)} />
                  <Button variant="outline" className="timeline-clear-filter" onClick={() => onFilterChange("all")}>
                    {t("Show all entries")}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      {filteredTimeline.length > limit && (
        <Button variant="outline" className="load-more" onClick={onShowMore}>
          {t("Show more entries")}
        </Button>
      )}
    </section>
  );
}
