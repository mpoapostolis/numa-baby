import { describe, expect, it } from "vitest";
import {
  MAX_REFERENCE_MONTHS,
  WEEKLY_GAIN_BANDS,
  WHO_WEIGHT_FOR_AGE,
  expectedWeightRange,
  typicalWeeklyGain,
} from "@/domain/growthReference";

describe("expectedWeightRange", () => {
  it("returns the table row exactly at listed months", () => {
    expect(expectedWeightRange(0, "boy")).toEqual({ p3: 2.5, p15: 2.9, p50: 3.3, p85: 3.9, p97: 4.3 });
    expect(expectedWeightRange(6, "girl")).toEqual({ p3: 5.8, p15: 6.4, p50: 7.3, p85: 8.3, p97: 9.2 });
    expect(expectedWeightRange(24, "boy")).toEqual({ p3: 9.8, p15: 10.8, p50: 12.2, p85: 13.7, p97: 15.1 });
  });

  it("interpolates linearly at midpoints between adjacent listed months", () => {
    // Boys 3→4 months: every percentile is the arithmetic middle at 3.5.
    expect(expectedWeightRange(3.5, "boy")).toEqual({ p3: 5.4, p15: 5.9, p50: 6.7, p85: 7.6, p97: 8.3 });
    // Girls 6→8 months span a 2-month gap; month 7 is the midpoint.
    expect(expectedWeightRange(7, "girl")).toEqual({ p3: 6.1, p15: 6.7, p50: 7.6, p85: 8.7, p97: 9.6 });
    // Boys 21→24: month 22 sits a third of the way along.
    expect(expectedWeightRange(22, "boy").p50).toBeCloseTo(11.7, 5);
  });

  it("stays monotonic within an interpolated result", () => {
    for (const age of [0.5, 4.25, 9, 13, 19.75]) {
      for (const sex of ["girl", "boy", undefined] as const) {
        const { p3, p15, p50, p85, p97 } = expectedWeightRange(age, sex);
        expect(p3).toBeLessThan(p15);
        expect(p15).toBeLessThan(p50);
        expect(p50).toBeLessThan(p85);
        expect(p85).toBeLessThan(p97);
      }
    }
  });

  it("builds the combined envelope when sex is undefined", () => {
    const combined = expectedWeightRange(6, undefined);
    const boys = expectedWeightRange(6, "boy");
    const girls = expectedWeightRange(6, "girl");
    // Lower edge takes the lower sex, upper edge the higher — wider than either.
    expect(combined.p3).toBe(Math.min(girls.p3, boys.p3));
    expect(combined.p15).toBe(Math.min(girls.p15, boys.p15));
    expect(combined.p85).toBe(Math.max(girls.p85, boys.p85));
    expect(combined.p97).toBe(Math.max(girls.p97, boys.p97));
    expect(combined.p50).toBeCloseTo((girls.p50 + boys.p50) / 2, 5);
    expect(combined.p97 - combined.p3).toBeGreaterThanOrEqual(boys.p97 - boys.p3);
    expect(combined.p97 - combined.p3).toBeGreaterThanOrEqual(girls.p97 - girls.p3);
  });

  it("clamps ages outside the 0–24 month table", () => {
    expect(expectedWeightRange(-3, "girl")).toEqual(expectedWeightRange(0, "girl"));
    expect(expectedWeightRange(36, "boy")).toEqual(expectedWeightRange(MAX_REFERENCE_MONTHS, "boy"));
    expect(expectedWeightRange(999, undefined)).toEqual(expectedWeightRange(24, undefined));
  });

  it("covers every listed month for both sexes without interpolation drift", () => {
    for (const sex of ["boy", "girl"] as const) {
      for (const row of WHO_WEIGHT_FOR_AGE[sex === "boy" ? "boys" : "girls"]) {
        const { month, ...percentiles } = row;
        expect(expectedWeightRange(month, sex)).toEqual(percentiles);
      }
    }
  });
});

describe("typicalWeeklyGain", () => {
  it("returns the newborn band through the first month", () => {
    expect(typicalWeeklyGain(0)).toMatchObject({ minGramsPerWeek: 150, maxGramsPerWeek: 200 });
    expect(typicalWeeklyGain(0.9)).toMatchObject({ minGramsPerWeek: 150, maxGramsPerWeek: 200 });
  });

  it("switches bands exactly at the exclusive upper edges", () => {
    expect(typicalWeeklyGain(1)).toMatchObject({ minGramsPerWeek: 160, maxGramsPerWeek: 210 });
    expect(typicalWeeklyGain(3.99)).toMatchObject({ minGramsPerWeek: 160, maxGramsPerWeek: 210 });
    expect(typicalWeeklyGain(4)).toMatchObject({ minGramsPerWeek: 105, maxGramsPerWeek: 130 });
    expect(typicalWeeklyGain(7.99)).toMatchObject({ minGramsPerWeek: 105, maxGramsPerWeek: 130 });
  });

  it("returns null past eight months — no defensible weekly figure exists", () => {
    expect(typicalWeeklyGain(8)).toBeNull();
    expect(typicalWeeklyGain(12)).toBeNull();
    expect(typicalWeeklyGain(24)).toBeNull();
  });

  it("clamps negative ages into the first band and names a source on every band", () => {
    expect(typicalWeeklyGain(-1)).toMatchObject({ fromMonth: 0 });
    for (const band of WEEKLY_GAIN_BANDS) {
      expect(band.source.length).toBeGreaterThan(0);
      expect(band.minGramsPerWeek).toBeLessThan(band.maxGramsPerWeek);
    }
  });
});
