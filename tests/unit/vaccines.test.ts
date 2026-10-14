import { expect, test } from "vitest";
import { dueLabel, vaccineLabel } from "@/domain/vaccines";
import { nextDose } from "@/domain/vaccineDoses";

// "In 4 days" reads at 3am; "Sun, Oct 18" needs a calendar.

const NOW = new Date(2026, 9, 14, 23, 30).getTime(); // late on the 14th

test("the days around today in words", () => {
  expect(dueLabel("2026-10-14", NOW)).toMatchObject({ text: "Today", overdue: false });
  expect(dueLabel("2026-10-15", NOW)).toMatchObject({ text: "Tomorrow", overdue: false });
  expect(dueLabel("2026-10-18", NOW)).toMatchObject({ text: "In 4 days", overdue: false });
  expect(dueLabel("2026-10-27", NOW)).toMatchObject({ text: "In 13 days", overdue: false });
});

test("further out, a date", () => {
  expect(dueLabel("2026-11-20", NOW).text).toBe("Fri, Nov 20");
});

test("a missed day is late, never quietly done", () => {
  expect(dueLabel("2026-10-13", NOW)).toMatchObject({ text: "Yesterday", overdue: true });
  expect(dueLabel("2026-10-11", NOW)).toMatchObject({ text: "3 days late", overdue: true });
});

test("midnight counts by the calendar, not by 24-hour blocks", () => {
  const justAfterMidnight = new Date(2026, 9, 15, 0, 5).getTime();
  expect(dueLabel("2026-10-15", justAfterMidnight).text).toBe("Today");
  expect(dueLabel("2026-10-14", justAfterMidnight).text).toBe("Yesterday");
});

test("a date in another year says which", () => {
  // The 15-month booster copied from the card at birth is not "Jan 15" —
  // that reads as three months away.
  expect(dueLabel("2028-01-15", NOW).text).toBe("Sat, Jan 15, 2028");
});

test("a vaccine is named with its dose, the way the card writes it", () => {
  expect(vaccineLabel({ vaccine: "PCV", dose: "2nd dose" })).toBe("PCV · 2nd dose");
  expect(vaccineLabel({ vaccine: "BCG" })).toBe("BCG");
});

test("the next dose is counted, never advised", () => {
  expect(nextDose("1st dose")).toBe("2nd dose");
  expect(nextDose("2nd dose")).toBe("3rd dose");
  expect(nextDose("3rd")).toBe("4th dose");
  expect(nextDose("Booster")).toBe("");
  expect(nextDose(undefined)).toBe("");
});

test("how far away, in days, for the row's own decisions", () => {
  expect(dueLabel("2026-10-18", NOW).days).toBe(4);
  expect(dueLabel("2026-10-11", NOW).days).toBe(-3);
});

test("inside a sentence the words are lower-case, a date is left alone", () => {
  expect(dueLabel("2026-10-18", NOW).inline).toBe("in 4 days");
  expect(dueLabel("2026-10-14", NOW).inline).toBe("today");
  expect(dueLabel("2026-10-11", NOW).inline).toBe("3 days late");
  expect(dueLabel("2026-11-20", NOW).inline).toBe("Fri, Nov 20");
});
