import { Square } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { formatTime, liveDuration } from "../domain/time";
import { Activity } from "../domain/types";
import { useSecondClock } from "../hooks/useMinuteClock";
import { ActivityGlyph } from "./ActivityGlyph";

export function ActiveTimerCard({ activity, onStop }: { activity: Activity; onStop: () => void }) {
  const now = useSecondClock();
  const isSleep = activity.type === "sleep";
  const title = isSleep
    ? "Sleeping"
    : `Nursing · ${activity.side === "left" ? "Left" : "Right"}`;
  const elapsed = liveDuration(activity.startedAt, now);

  return (
    <Card className={`active-card active-${activity.type}`}>
      <span className="active-icon"><ActivityGlyph type={activity.type} /></span>
      <div className="active-copy">
        <strong>{title}</strong>
        <span>Started at {formatTime(activity.startedAt)}</span>
      </div>
      <div className="active-elapsed">
        <small>Elapsed</small>
        <strong>{elapsed}</strong>
      </div>
      <Button onClick={onStop} aria-label={`Stop ${title.toLowerCase()} timer`}>
        <Square size={14} fill="currentColor" /> Stop
      </Button>
    </Card>
  );
}
