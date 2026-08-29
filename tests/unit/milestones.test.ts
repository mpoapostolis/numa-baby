import { describe, expect, it } from "vitest";
import { milestoneFor } from "@/domain/milestones";

const at = (iso: string) => new Date(`${iso}T09:00:00`).getTime();

describe("milestoneFor", () => {
  it("celebrates one week, one hundred days, and month-birthdays", () => {
    expect(milestoneFor("2026-08-01", "Serafina", at("2026-08-08"))?.id).toBe("d7");
    expect(milestoneFor("2026-05-01", "Serafina", at("2026-08-09"))?.id).toBe("d100");
    expect(milestoneFor("2026-07-15", "Serafina", at("2026-08-15"))?.title).toBe("Serafina is 1 month old today");
    expect(milestoneFor("2026-07-15", "Serafina", at("2026-08-16"))).toBeNull();
    expect(milestoneFor("2026-07-15", "Serafina", at("2026-08-14"))).toBeNull();
  });

  // Born on the 31st: short months must clamp, not skip the party.
  it("clamps the party day for babies born late in the month", () => {
    expect(milestoneFor("2026-08-31", "Ava", at("2026-09-30"))?.id).toBe("m1");
    expect(milestoneFor("2025-01-31", "Ava", at("2025-02-28"))?.id).toBe("m1");
  });

  it("switches to birthdays only after two years", () => {
    expect(milestoneFor("2024-08-29", "Ava", at("2026-08-29"))?.title).toBe("Ava is 2 years old today!");
    expect(milestoneFor("2024-06-15", "Ava", at("2026-08-15"))).toBeNull(); // 26 months
    expect(milestoneFor("2025-08-29", "Ava", at("2026-08-29"))?.sub).toContain("One whole year");
  });

  it("says nothing on an ordinary day, or without a birth date", () => {
    expect(milestoneFor("2026-07-03", "Ava", at("2026-08-20"))).toBeNull();
    expect(milestoneFor(undefined, "Ava", at("2026-08-20"))).toBeNull();
    expect(milestoneFor("2027-01-01", "Ava", at("2026-08-20"))).toBeNull();
  });
});
