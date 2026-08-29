// Pure date/duration helpers shared by the app and the unit suite. Everything
// here is deterministic given its inputs — helpers that need "now" accept it.

type TimedSpan = {
  startedAt: string;
  endedAt?: string;
};

const timeFormat = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const shortDayFormat = new Intl.DateTimeFormat("en", { weekday: "short" });

const timelineDayFormat = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export function localDateInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function formatTime(value: string) {
  return timeFormat.format(new Date(value));
}

export function formatShortDay(date: Date) {
  return shortDayFormat.format(date);
}

export function formatTimelineDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(value, today)) return "Today";
  if (isSameDay(value, yesterday)) return "Yesterday";
  return timelineDayFormat.format(date);
}

export function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "You’re up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function minutesBetween(start: string, end = new Date().toISOString()) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}

export function humanDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
}

export function forecastRelative(target: number, now: number) {
  const minutes = Math.round((target - now) / 60_000);
  if (minutes < -30) return "Past the usual window";
  if (minutes <= 15) return "Check cues now";
  return `Likely in ${humanDuration(minutes)}`;
}

export function forecastRange(target: number, spreadMinutes: number) {
  const start = new Date(target - spreadMinutes * 60_000).toISOString();
  const end = new Date(target + spreadMinutes * 60_000).toISOString();
  return `${formatTime(start)}–${formatTime(end)}`;
}

export function liveDuration(start: string, now: number) {
  const totalSeconds = Math.max(
    0,
    Math.floor((now - new Date(start).getTime()) / 1_000),
  );
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return hours > 0 ? `${hours}:${clock}` : clock;
}

export function minutesOnDay(activity: TimedSpan, day: Date, now = Date.now()) {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const start = Math.max(new Date(activity.startedAt).getTime(), dayStart.getTime());
  const end = Math.min(activity.endedAt ? new Date(activity.endedAt).getTime() : now, dayEnd.getTime());
  return Math.max(0, Math.round((end - start) / 60_000));
}

// "3 weeks" / "2 months" for the welcome hero: weeks under 8, calendar
// months after, plain days in the first week. Ages count COMPLETED units
// (the paediatrician's convention: a baby turns "2 weeks" at 14 full days),
// but in the last two days of a week we say "almost 2 weeks" — a parent
// reading "Day 14" next to "1 week old" rightly calls that a bug.
// Null when there is no (usable) birth date — callers fall back to a
// plain welcome.
export function formatBabyAge(birthDate: string | undefined, now: number): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const birthMs = birth.getTime();
  if (Number.isNaN(birthMs) || birthMs > now) return null;
  const days = Math.floor((now - birthMs) / 86_400_000);
  const weeks = Math.floor(days / 7);
  if (days === 0) return "born today";
  if (weeks < 1) return days === 1 ? "1 day" : `${days} days`;
  if (weeks < 8) {
    const at8 = new Date(now);
    const monthsSoFar =
      (at8.getFullYear() - birth.getFullYear()) * 12 +
      (at8.getMonth() - birth.getMonth()) -
      (at8.getDate() < birth.getDate() ? 1 : 0);
    if (monthsSoFar < 1) {
      if (days % 7 >= 5) return `almost ${weeks + 1} weeks`;
      return weeks === 1 ? "1 week" : `${weeks} weeks`;
    }
  }
  const at = new Date(now);
  const months =
    (at.getFullYear() - birth.getFullYear()) * 12 +
    (at.getMonth() - birth.getMonth()) -
    (at.getDate() < birth.getDate() ? 1 : 0);
  // Months from the FIRST completed calendar month. The screen that proved
  // the old rule wrong showed "1 month old today" (the milestone card) above
  // "4 weeks old" (this line) — the same baby, the same morning. Weeks stay
  // for the newborn window where every jab and every midwife speaks weeks.
  if (months < 1) return `${weeks} weeks`;
  return months === 1 ? "1 month" : `${months} months`;
}

// Whole days since birth for the day counter and the fact engine. Null on
// missing/invalid/future birth dates — the same "no usable age" contract as
// formatBabyAge above.
export function ageInDays(birthDate: string | undefined, now: number): number | null {
  if (!birthDate) return null;
  const birthMs = new Date(birthDate).getTime();
  if (Number.isNaN(birthMs) || birthMs > now) return null;
  return Math.floor((now - birthMs) / 86_400_000);
}

export function ageInMonths(birthDate: string) {
  const birth = new Date(`${birthDate}T12:00:00`);
  if (!Number.isFinite(birth.getTime())) return null;
  const today = new Date();
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

export function timeAgo(value?: string, now = Date.now()) {
  if (!value) return "No entries yet";
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function isSameDay(value: string, day: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}
