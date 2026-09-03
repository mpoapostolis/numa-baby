// The words on the reminders announcement.
//
// Its own module for two reasons. It is imported only by the lazy card, so a
// parent who never sees the banner never downloads two paragraphs about it on
// the boot they wait through at 3am — the rules module that decides WHETHER
// to show it is on the boot path, and had to stay small. And a file that
// exports both a component and a constant loses fast refresh.

import type { ReminderNudge } from "../domain/reminderNudge";

export const REMINDER_COPY: Record<ReminderNudge, { headline: string; body: string }> = {
  ask: {
    headline: "Reminders now ring with the app closed",
    body: "They used to be a timer inside this page, so closing the app silenced them. Now they arrive whether or not it is open. Your phone will ask you to allow notifications.",
  },
  granted: {
    headline: "Reminders can ring with the app closed",
    body: "You have already allowed notifications. Switching the feed reminder on is the only step left.",
  },
};
