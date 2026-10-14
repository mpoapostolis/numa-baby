// Words for a vaccination's date. "In 4 days" reads at 3am; "Sun, Oct 18"
// needs a calendar. Days are counted by the calendar, not in 24-hour blocks:
// at five past midnight, the appointment that was "tomorrow" is "today".

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

/** "PCV · 2nd dose" — a vaccine named the way the card writes it. */
export function vaccineLabel(entry: { vaccine?: string; dose?: string }): string {
  return `${entry.vaccine ?? "Vaccine"}${entry.dose ? ` · ${entry.dose}` : ""}`;
}
