// Words for a vaccination's date. "In 4 days" reads at 3am; "Sun, Oct 18"
// needs a calendar. Days are counted by the calendar, not in 24-hour blocks:
// at five past midnight, the appointment that was "tomorrow" is "today".

import { currentLocale, t } from "../i18n";

const later = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" });
const laterYear = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

function localMidnight(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/** A planned vaccine's `due` (YYYY-MM-DD) as words — `text` to stand alone,
    `inline` for inside a sentence — whether it is late, and how many calendar
    days away it is (negative once past). */
export function dueLabel(due: string, now: number): { text: string; inline: string; overdue: boolean; days: number } {
  const [year, month, day] = due.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const days = Math.round((localMidnight(target) - localMidnight(new Date(now))) / 86_400_000);
  if (days === 0) return { text: "Today", inline: "today", overdue: false, days };
  if (days === 1) return { text: "Tomorrow", inline: "tomorrow", overdue: false, days };
  if (days === -1) return { text: "Yesterday", inline: "yesterday", overdue: true, days };
  if (days < 0) return { text: `${-days} days late`, inline: `${-days} days late`, overdue: true, days };
  if (days < 14) return { text: `In ${days} days`, inline: `in ${days} days`, overdue: false, days };
  // Another year says so: the 15-month booster is not "Jan 15".
  const format = target.getFullYear() === new Date(now).getFullYear() ? later : laterYear;
  const text = format.format(target);
  // A date keeps its capitals inside a sentence ("due Sun, Oct 18").
  return { text, inline: text, overdue: false, days };
}

/** dueLabel's words in the reader's language, from the same day count. dueLabel
    itself stays English, because its output is compared and tested; this is
    what Today and the Vaccines sheet show. */
export function dueWords(due: string, now: number): ReturnType<typeof dueLabel> {
  const label = dueLabel(due, now);
  if (currentLocale() === "en") return label;
  const { days } = label;
  if (days === 0) return { ...label, text: t("Today"), inline: t("today") };
  if (days === 1) return { ...label, text: t("Tomorrow"), inline: t("tomorrow") };
  if (days === -1) return { ...label, text: t("Yesterday"), inline: t("yesterday") };
  if (days < 0) {
    const late = t("{n} days late", { n: -days });
    return { ...label, text: late, inline: late };
  }
  if (days < 14) return { ...label, text: t("In {n} days", { n: days }), inline: t("in {n} days", { n: days }) };
  const target = new Date(`${due}T12:00:00`);
  const sameYear = target.getFullYear() === new Date(now).getFullYear();
  const text = target.toLocaleDateString(currentLocale(), sameYear
    ? { weekday: "short", month: "short", day: "numeric" }
    : { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  return { ...label, text, inline: text };
}

/** "PCV · 2nd dose" — a vaccine named the way the card writes it. */
export function vaccineLabel(entry: { vaccine?: string; dose?: string }): string {
  return `${entry.vaccine ?? "Vaccine"}${entry.dose ? ` · ${entry.dose}` : ""}`;
}

/** Late, or due within the week: the doses the Vaccines card offers a
    one-tap Given for, and the one Today names at the top. */
export function dueSoon(entry: { due?: string }, now: number): boolean {
  if (!entry.due) return false;
  const due = dueLabel(entry.due, now);
  return due.overdue || due.days <= 7;
}
