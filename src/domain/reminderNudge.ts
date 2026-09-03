// Telling a parent that reminders now survive the app being closed.
//
// This is an announcement AND an ask, which is the awkward part: the useful
// version of "we built this" is a button that turns it on, and a button that
// asks for notification permission is the most easily resented thing an app
// can put in front of someone. So the rules exist to make sure it is only
// ever shown to a person for whom the answer is plausibly yes:
//
//   • Never if it would not work. On a browser without push, or a deployment
//     with no signing key, the headline would be a lie.
//   • Never if they already said no. The browser will not ask twice anyway,
//     so the banner would be a button that does nothing.
//   • Never if reminders are already on. They have it.
//   • Not until they have logged a few feeds. A reminder counts FROM the last
//     feed, so before there is a rhythm there is nothing to remind about, and
//     interrupting somebody's first hour to ask for permission is how an app
//     gets its notifications turned off for ever.
//   • "Not now" lasts a month. It is news, not an emergency.

export type ReminderNudgeInput = {
  /** Push is possible here: the browser supports it AND the deployment
      answered with a signing key. Null while that is still unknown. */
  pushReady: boolean | null;
  permission: NotificationPermission | "unsupported";
  /** Either reminder already switched on. */
  remindersOn: boolean;
  /** Feeds logged. Not entries — a nappy every hour is not a feed rhythm. */
  feeds: number;
  /** When the banner was last dismissed, ISO, or null. */
  dismissedAt: string | null;
};

/**
 * Which of the two things there is to say — not the words themselves.
 *
 * "ask" still has to warn about the permission prompt; "granted" has nothing
 * to agree to and would sound like a needless warning if it did. The wording
 * lives in components/ReminderNudge.tsx because that file is lazy: a parent
 * who will never see this banner should not download two paragraphs about it
 * on the boot they wait through at 3am.
 */
export type ReminderNudge = "ask" | "granted";

/** Enough of a rhythm for a reminder to mean something. */
export const MIN_FEEDS = 4;
/** How long "not now" lasts. */
export const DISMISS_DAYS = 30;

const DAY = 24 * 60 * 60_000;

export function reminderNudge(input: ReminderNudgeInput, now: number): ReminderNudge | null {
  if (!input.pushReady) return null;
  // "denied" and "unsupported" both mean the button cannot deliver: the
  // browser will not ask a second time, so offering is worse than silence.
  if (input.permission === "denied" || input.permission === "unsupported") return null;
  if (input.remindersOn) return null;
  if (input.feeds < MIN_FEEDS) return null;

  if (input.dismissedAt) {
    const then = Date.parse(input.dismissedAt);
    if (Number.isFinite(then) && (now - then) / DAY < DISMISS_DAYS) return null;
  }

  return input.permission === "granted" ? "granted" : "ask";
}
