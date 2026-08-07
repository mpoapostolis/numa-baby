import { memo } from "react";
import { Pencil } from "lucide-react";
import { Button } from "./ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "./ui/item";
import { activityDetail, activityTitle } from "../domain/activityDisplay";
import { formatTime } from "../domain/time";
import { Activity } from "../domain/types";
import { ActivityGlyph } from "./ActivityGlyph";

// Memoised: 80 timeline rows must not re-render on every minute tick. The
// onEdit callback is stabilised with useCallback where the rows are rendered.
export const ActivityRow = memo(function ActivityRow({
  activity,
  onEdit,
}: {
  activity: Activity;
  onEdit: (activity: Activity) => void;
}) {
  return (
    <Item asChild size="sm" className="activity-row">
      <Button variant="ghost" className="activity-open" onClick={() => onEdit(activity)} aria-label={`Edit ${activityTitle(activity)} from ${formatTime(activity.startedAt)}`}>
        <ItemMedia variant="icon" className={`activity-glyph glyph-${activity.type}`}><ActivityGlyph type={activity.type} /></ItemMedia>
        <ItemContent className="activity-copy">
          <ItemTitle>{activityTitle(activity)}</ItemTitle>
          <ItemDescription>{activityDetail(activity)}</ItemDescription>
        </ItemContent>
        <ItemActions className="activity-meta">
          <time dateTime={activity.startedAt}>{formatTime(activity.startedAt)}</time>
          <Pencil className="activity-row-action" aria-hidden="true" />
        </ItemActions>
      </Button>
    </Item>
  );
});
