// The little parties.
//
// A baby tracker knows the one date that matters and sees the parent every
// day — it would be a waste of both not to say "happy first month" on the
// morning it is true. These are BABY milestones, never usage streaks: the
// app celebrates the child, not the logging. That line matters; on the
// wrong side of it this becomes a slot machine.
//
// The set: one week, one hundred days (a real celebration in Filipino and
// Chinese families, and most of this app's families are in the Philippines),
// every month-birthday through the second year, then birthdays. Month
// birthdays are CALENDAR months — the same day-of-month as the birth,
// clamped for short months so a baby born on the 31st still gets a party
// on the 30th (or Feb 28th) instead of skipping the month.

export type Milestone = {
  /** Stable id, used to remember that this party has been shown. */
  id: string;
  title: string;
  sub: string;
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function milestoneFor(
  birthDate: string | undefined,
  name: string,
  now: number,
): Milestone | null {
  if (!birthDate) return null;
  // Noon anchor for the CALENDAR fields (safe against UTC shifting the date),
  // midnight anchor for the DAY COUNT (so "one week" flips at the start of
  // day seven, not at whatever hour the birth string happens to parse to).
  const birth = new Date(`${birthDate.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(birth.getTime()) || birth.getTime() - 12 * 3600_000 > now) return null;
  const who = name.trim() || "Your baby";
  const midnight = new Date(birth);
  midnight.setHours(0, 0, 0, 0);
  const days = Math.floor((now - midnight.getTime()) / 86_400_000);

  if (days === 7) {
    return { id: "d7", title: `${who} is 1 week old today`, sub: "Seven days of getting to know each other." };
  }
  if (days === 100) {
    return { id: "d100", title: `100 days of ${who}`, sub: "A hundred days — that deserves its own little party." };
  }

  const at = new Date(now);
  const monthsElapsed =
    (at.getFullYear() - birth.getFullYear()) * 12 + (at.getMonth() - birth.getMonth());
  if (monthsElapsed < 1) return null;
  const celebrationDay = Math.min(birth.getDate(), daysInMonth(at.getFullYear(), at.getMonth()));
  if (at.getDate() !== celebrationDay) return null;

  if (monthsElapsed % 12 === 0) {
    const years = monthsElapsed / 12;
    return {
      id: `m${monthsElapsed}`,
      title: years === 1 ? `${who} is 1 year old today!` : `${who} is ${years} years old today!`,
      sub: years === 1 ? "One whole year. Happy birthday, little one." : "Happy birthday, little one.",
    };
  }
  // Monthly through the second year; after that, only birthdays — a
  // twenty-nine-month party would be the app celebrating, not the family.
  if (monthsElapsed > 23) return null;
  return {
    id: `m${monthsElapsed}`,
    title: monthsElapsed === 1 ? `${who} is 1 month old today` : `${who} is ${monthsElapsed} months old today`,
    sub: monthsElapsed === 1 ? "The first of many month-birthdays." : "Happy month-birthday.",
  };
}

const SEEN_KEY = "numalog-milestones-v1";

export function milestoneSeen(id: string): boolean {
  try {
    return (window.localStorage.getItem(SEEN_KEY) ?? "").split(",").includes(id);
  } catch {
    return false;
  }
}

export function markMilestoneSeen(id: string) {
  try {
    const seen = (window.localStorage.getItem(SEEN_KEY) ?? "").split(",").filter(Boolean);
    if (!seen.includes(id)) seen.push(id);
    window.localStorage.setItem(SEEN_KEY, seen.join(","));
  } catch {
    // Worst case the party repeats on the next open, same day. Survivable.
  }
}
