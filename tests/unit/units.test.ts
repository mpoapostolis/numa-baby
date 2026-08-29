import { describe, expect, it } from "vitest";
import {
  cmToIn,
  formatKg,
  formatLength,
  formatVolume,
  formatWeight,
  inToCm,
  lbToGrams,
  ozToMl,
  volumeParts,
  weightParts,
} from "@/domain/units";

describe("unit conversion at the display edge", () => {
  it("speaks millilitres untouched in metric", () => {
    expect(formatVolume(120, "metric")).toBe("120 ml");
    expect(formatWeight(4_200, "metric")).toBe("4.20 kg");
    expect(formatLength(56.5, "metric")).toBe("56.5 cm");
  });

  it("says ounces the way a parent says them", () => {
    expect(formatVolume(120, "us")).toBe("4.1 oz");
    expect(formatVolume(89, "us")).toBe("3 oz");
    expect(volumeParts(240, "us")).toEqual({ value: "8.1", unit: "oz" });
  });

  it("says pounds-and-ounces, and carries the sixteenth ounce", () => {
    expect(formatWeight(3_200, "us")).toBe("7 lb 1 oz");
    // 3620g = 7.981 lb = 7 lb 15.7 oz — must carry to 8 lb, never "7 lb 16 oz".
    expect(formatWeight(3_620, "us")).toBe("8 lb 0 oz");
    expect(weightParts(4_200, "us")).toEqual({ value: "9.26", unit: "lb" });
    expect(formatKg(4.5, "us")).toBe("9.9 lb");
  });

  it("round-trips input conversions inside a gram and a millimetre", () => {
    expect(ozToMl(4)).toBe(118);
    expect(lbToGrams(7.5)).toBe(3402);
    expect(inToCm(22)).toBe(55.9);
    expect(Math.abs(cmToIn(inToCm(21.5)) - 21.5)).toBeLessThan(0.05);
  });
});
