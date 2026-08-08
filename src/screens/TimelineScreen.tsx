import { useMemo } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { ItemGroup, ItemSeparator } from "../components/ui/item";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { ActivityRow } from "../components/ActivityRow";
import { EmptyState } from "../components/EmptyState";
import { formatTimelineDay } from "../domain/time";
import { Activity, ActivityType } from "../domain/types";

type TimelineScreenProps = {
  activities: Activity[];
  filter: "all" | ActivityType;
  limit: number;
  onFilterChange: (filter: "all" | ActivityType) => void;
  onShowMore: () => void;
  onEdit: (activity: Activity) => void;
};

export default function TimelineScreen({
  activities,
  filter,
  limit,
  onFilterChange,
  onShowMore,
  onEdit,
}: TimelineScreenProps) {
  const filteredTimeline = useMemo(
    () => activities.filter((activity) => filter === "all" || activity.type === filter),
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

  return (
    <section className="screen timeline-screen" aria-labelledby="timeline-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">The full picture</p>
          <h1 id="timeline-heading">Timeline</h1>
        </div>
        <Badge variant="outline" className="count-badge"><span aria-live="polite">{filteredTimeline.length} logs</span></Badge>
      </div>
      <div className="timeline-controls">
        <ToggleGroup
          type="single"
          value={filter}
          className="filter-row"
          aria-label="Filter timeline"
          onValueChange={(value) => {
            if (!value) return;
            onFilterChange(value as "all" | ActivityType);
          }}
        >
          {(["all", "bottle", "nursing", "diaper", "sleep", "growth", "health"] as const).map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              aria-label={`Show ${option} logs`}
            >
              {option === "all" ? "All" : option[0].toUpperCase() + option.slice(1)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {filteredTimeline.length > 0 && (
          <div className="timeline-date"><span>Latest first</span><span>Open any log to correct its details</span></div>
        )}
      </div>
      <div className="timeline-groups">
        {timelineGroups.map((group) => (
          <section className="timeline-day" key={new Date(group[0].startedAt).toDateString()}>
            <div className="timeline-day-heading">
              <h2>{formatTimelineDay(group[0].startedAt)}</h2>
              <span>{group.length} {group.length === 1 ? "log" : "logs"}</span>
            </div>
            <Card size="sm" className="activity-list timeline-list">
              <CardContent className="activity-list-content">
                <ItemGroup>
                  {group.map((activity, index) => (
                    <div role="listitem" key={activity.id}>
                      {index > 0 && <ItemSeparator />}
                      <ActivityRow activity={activity} onEdit={onEdit} />
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
                <EmptyState text="Nothing logged yet — your day builds here from the Today screen." />
              ) : (
                <>
                  <EmptyState text={`No ${filter} logs yet.`} />
                  <Button variant="outline" className="timeline-clear-filter" onClick={() => onFilterChange("all")}>
                    Show all logs
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      {filteredTimeline.length > limit && (
        <Button variant="outline" className="load-more" onClick={onShowMore}>
          Show more logs
        </Button>
      )}
    </section>
  );
}
