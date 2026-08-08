import { memo } from "react";
import { Pencil } from "lucide-react";
import { Button } from "./ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
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
  const detail = activityDetail(activity);
  return (
    <Item asChild size="sm" className="activity-row">
      <Button variant="ghost" className="activity-open" onClick={() => onEdit(activity)}>
        <span className="sr-only">Edit </span>
        <ItemMedia variant="icon" className={`activity-glyph glyph-${activity.type}`}><ActivityGlyph type={activity.type} /></ItemMedia>
        <ItemContent className="activity-copy">
          <ItemTitle>{activityTitle(activity)}</ItemTitle>
          {/* Rendered as a span, not ItemDescription: no <p> inside a button. */}
          {detail && <span data-slot="item-description">{detail}</span>}
        </ItemContent>
        <ItemActions className="activity-meta">
          <time dateTime={activity.startedAt}>{formatTime(activity.startedAt)}</time>
          <Pencil className="activity-row-action" aria-hidden="true" />
        </ItemActions>
      </Button>
    </Item>
  );
});
