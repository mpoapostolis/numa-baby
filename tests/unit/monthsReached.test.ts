import { expect, test } from "vitest";
import { monthsReached } from "@/domain/keepsakes";
import { monthSlots } from "@/domain/months";

// The pill on Today and the album must agree on which month it is — on the
// clamped days too (born on the 31st: the month-birthday in a 30-day month
// is the 30th).
test("the month on Today is the album's newest page, every day for two years", () => {
  for (const birthDate of ["2026-01-31", "2024-02-29", "2026-05-15", "2026-08-30", "2025-12-01"]) {
    const birth = new Date(`${birthDate}T12:00:00`).getTime();
    for (let day = -3; day < 760; day++) {
      for (const hour of [0, 9, 23]) {
        const at = new Date(birth + day * 86_400_000);
        at.setHours(hour, 30, 0, 0);
        const now = at.getTime();
        const album = monthSlots(birthDate, now)[0]?.month ?? 0;
        const reached = monthsReached(birthDate, now);
        expect(Math.min(reached ?? -1, 24), `${birthDate} at ${at.toString()}`).toBe(album);
      }
    }
  }
});

test("no date it can read, no month", () => {
  expect(monthsReached("not a date", Date.now())).toBeNull();
});
