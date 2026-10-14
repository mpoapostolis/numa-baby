import { expect, test } from "vitest";
import { MONTHS_KEPT, monthLabel, monthSlots } from "@/domain/months";

// Asked for from the feedback box: "a monthly milestone note for our baby,
// and upload their pictures in profile or just a monthly photo". One slot per
// month-birthday — the same calendar months the little parties use.

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

test("a baby gets a slot for every month-birthday reached, newest first", () => {
  const slots = monthSlots("2026-06-15", at(2026, 10, 14));
  expect(slots.map((s) => s.month)).toEqual([3, 2, 1]);
  expect(slots[0].date.getMonth()).toBe(8); // 15 September
  expect(slots[0].date.getDate()).toBe(15);
});

test("the month-birthday itself opens that month's slot", () => {
  expect(monthSlots("2026-06-15", at(2026, 10, 15)).map((s) => s.month)[0]).toBe(4);
});

test("before the first month-birthday there is nothing yet", () => {
  expect(monthSlots("2026-09-20", at(2026, 10, 19))).toEqual([]);
  expect(monthSlots("", at(2026, 10, 19))).toEqual([]);
});

test("a baby born on the 31st has a month-birthday in a short month", () => {
  // The same clamp as the parties: 30 November, not skipped.
  const slots = monthSlots("2026-10-31", at(2026, 11, 30));
  expect(slots.map((s) => s.month)).toEqual([1]);
  expect(slots[0].date.getDate()).toBe(30);
});

test("the slots stop where the monthly parties stop", () => {
  expect(MONTHS_KEPT).toBe(24);
  expect(monthSlots("2023-01-10", at(2026, 10, 14))).toHaveLength(24);
});

test("a month is said the way the party card says it", () => {
  // "4 months", the age — not "Month 4", which reads as the fourth month of life.
  expect(monthLabel(1)).toBe("1 month");
  expect(monthLabel(4)).toBe("4 months");
  expect(monthLabel(12)).toBe("1 year");
  expect(monthLabel(18)).toBe("18 months");
  expect(monthLabel(24)).toBe("2 years");
});
