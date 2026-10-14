// A page per month: a note and a photo for each month-birthday.
//
// Asked for from the feedback box by a parent who saved the app before the
// birth: "a monthly milestone note for our baby, and upload their pictures
// in profile or just a monthly photo". The months are the same calendar
// month-birthdays the little parties use (domain/milestones.ts): the same
// day-of-month as the birth, clamped for short months, through the second
// year.
//
// Each month's note and photo is an entry in the log (type "month"), so it
// syncs, backs up and merges like any other entry; the photo itself is kept
// by lib/photos.ts.

import { MONTHS_KEPT } from "./keepsakes";

export { MONTHS_KEPT };

export type MonthSlot = {
  /** 1 for the first month-birthday. */
  month: number;
  /** The month-birthday itself, at local noon. */
  date: Date;
};

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function monthBirthday(birth: Date, months: number): Date {
  const year = birth.getFullYear();
  const month = birth.getMonth() + months;
  const first = new Date(year, month, 1, 12);
  const day = Math.min(birth.getDate(), daysInMonth(first.getFullYear(), first.getMonth()));
  return new Date(first.getFullYear(), first.getMonth(), day, 12);
}

/** The n-th month-birthday of a baby born on `birthDate`, at local noon. */
export function monthBirthdayOf(birthDate: string, month: number): Date | null {
  const birth = new Date(`${birthDate.slice(0, 10)}T12:00:00`);
  return Number.isFinite(birth.getTime()) ? monthBirthday(birth, month) : null;
}

/** Every month-birthday reached by `now`, newest first. */
export function monthSlots(birthDate: string, now: number): MonthSlot[] {
  if (!birthDate) return [];
  const birth = new Date(`${birthDate.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(birth.getTime())) return [];
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  const slots: MonthSlot[] = [];
  for (let month = 1; month <= MONTHS_KEPT; month++) {
    const date = monthBirthday(birth, month);
    if (date.getTime() > today.getTime()) break;
    slots.push({ month, date });
  }
  return slots.reverse();
}

/**
 * One entry per month, whichever phone writes it: the id is the month, so two
 * parents who both write month 3 end up with one row (last write wins), not
 * two that every screen would have to choose between.
 */
export function monthEntryId(month: number): string {
  return `month-${month}`;
}

/** "4 months", "1 year" — the age, the way the party card says it. "Month 4"
    reads as the fourth month of life, one less than the baby's age. */
export function monthLabel(month: number): string {
  if (month % 12 === 0) return month === 12 ? "1 year" : `${month / 12} years`;
  return month === 1 ? "1 month" : `${month} months`;
}
