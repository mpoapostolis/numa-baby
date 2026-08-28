import { describe, expect, it } from "vitest";
import { DAILY_ML_CEILING, guidanceFor } from "@/domain/intakeGuide";

// The refusals matter more than the arithmetic: a number shown to the wrong
// family, or on thin data, invents a worry that was never there.

describe("guidanceFor refuses when it cannot be honest", () => {
  it("never volume-targets a breastfed baby", () => {
    expect(guidanceFor(4200, 600, 7, "breast")).toBeNull();
  });

  it("says nothing without a weight", () => {
    expect(guidanceFor(undefined, 600, 7, "mixed")).toBeNull();
    expect(guidanceFor(0, 600, 7, "mixed")).toBeNull();
  });

  it("says nothing on one or two stray bottle days", () => {
    expect(guidanceFor(4200, 600, 2, "mixed")).toBeNull();
    expect(guidanceFor(4200, 600, 3, "mixed")).not.toBeNull();
  });
});

describe("the reference band", () => {
  it("follows the AAP figure of 75 ml per 453 g", () => {
    // 4.53 kg is exactly 10 lb, so the centre should be 750 ml.
    const found = guidanceFor(4530, 750, 7, "bottle");
    expect(found).not.toBeNull();
    expect(found!.lowMl).toBe(675);
    expect(found!.highMl).toBe(825);
    expect(found!.position).toBe("within");
  });

  it("never recommends more than the daily ceiling", () => {
    const found = guidanceFor(9000, 900, 7, "bottle");
    expect(found!.highMl).toBeLessThanOrEqual(DAILY_ML_CEILING);
    expect(found!.cappedByCeiling).toBe(true);
  });

  it("places a typical day below, within or above without grading it", () => {
    expect(guidanceFor(4530, 500, 7, "bottle")!.position).toBe("below");
    expect(guidanceFor(4530, 750, 7, "bottle")!.position).toBe("within");
    expect(guidanceFor(4530, 900, 7, "bottle")!.position).toBe("above");
  });
});
