// The card that says reminders now survive the app being closed.
//
// Dressed exactly like its backup sibling — same banner stack, same shape,
// same "not now" — because a parent should not have to learn a new kind of
// interruption. The rules for WHEN it appears live in
// domain/reminderNudge.ts so they can be tested rather than argued about.

import { BellRing } from "lucide-react";
import { Button } from "./ui/button";
import type { ReminderNudge as Nudge } from "../domain/reminderNudge";
import { REMINDER_COPY } from "./reminderCopy";

export function ReminderNudgeCard({
  nudge,
  onEnable,
  onDismiss,
}: {
  nudge: Nudge;
  onEnable: () => void;
  onDismiss: () => void;
}) {
  const copy = REMINDER_COPY[nudge];
  return (
    <div className="banner-stack">
      <div className="backup-nudge tone-info" role="status">
        <span className="backup-nudge-icon" aria-hidden="true"><BellRing /></span>
        <div className="backup-nudge-copy">
          <strong>{copy.headline}</strong>
          <small>{copy.body}</small>
        </div>
        <div className="backup-nudge-actions">
          <Button onClick={onEnable}>Turn on reminders</Button>
          <Button variant="ghost" onClick={onDismiss}>Not now</Button>
        </div>
      </div>
    </div>
  );
}
