/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GrowthChart } from "@/components/GrowthChart";
import { InsightInput, insightsFor } from "@/domain/insightRules";
import { Activity } from "@/domain/types";
import { fToC, formatGrams, setUnits } from "@/domain/units";

// A parent on US units typed 100.8 °F and was read back "You logged 38.2 °C",
// a number they never typed; the Growth card said "Up 400 g" beside a latest
// weight in pounds. The arithmetic stays metric; only the words convert.

afterEach(() => {
  cleanup();
  setUnits("metric");
});

describe("formatGrams", () => {
  it("speaks a gain in each audience's small unit, sign kept", () => {
    expect(formatGrams(400, "metric")).toBe("400 g");
    expect(formatGrams(80.4, "metric")).toBe("80 g");
    expect(formatGrams(400, "us")).toBe("14.1 oz");
    expect(formatGrams(-80, "us")).toBe("-2.8 oz");
  });

  it("switches to pounds and ounces once past a pound", () => {
    expect(formatGrams(500, "us")).toBe("1 lb 2 oz");
    expect(formatGrams(-500, "us")).toBe("-1 lb 2 oz");
    expect(formatGrams(453, "us")).toBe("1 lb 0 oz");
  });
});

describe("the Growth card", () => {
  const checks: Activity[] = [
    { id: "a", type: "growth", startedAt: "2026-09-01T10:00:00", weightGrams: 4000 },
    { id: "b", type: "growth", startedAt: "2026-09-15T10:00:00", weightGrams: 4400 },
  ];
  const card = (change: number) => {
    render(<GrowthChart activities={checks} change={change} figure={2} onAdd={() => {}} onOpenGuide={() => {}} />);
    return {
      headline: document.querySelector(".growth-card h2")!.textContent,
      tile: document.querySelector(".growth-overview")!.textContent,
    };
  };

  it("gives the change in ounces on US units", () => {
    setUnits("us");
    const { headline, tile } = card(400);
    expect(headline).toBe("Up 14.1 oz since the last check.");
    expect(tile).toContain("+14.1 oz");
    expect(tile).not.toMatch(/\d g/);
  });

  it("gives a loss past a pound in pounds and ounces", () => {
    setUnits("us");
    const { headline, tile } = card(-500);
    expect(headline).toBe("Down 1 lb 2 oz since the last check.");
    expect(tile).toContain("-1 lb 2 oz");
  });

  it("still speaks grams on metric", () => {
    const { headline, tile } = card(400);
    expect(headline).toBe("Up 400 g since the last check.");
    expect(tile).toContain("+400 g");
  });
});

describe("insight cards on US units", () => {
  const NOW = Date.parse("2026-08-22T18:00:00");
  const input = (overrides: Partial<InsightInput>): InsightInput => ({
    units: "us",
    ageDays: 30,
    ageMonths: 1,
    feedingMode: "mixed",
    days: [],
    weights: [],
    recentBottleMl: [],
    recentBurps: 0,
    now: NOW,
    ...overrides,
  });
  const weight = (id: string, startedAt: string, weightGrams: number): Activity => ({ id, type: "growth", startedAt, weightGrams });
  const card = (id: string, overrides: Partial<InsightInput>) => insightsFor(input(overrides)).find((found) => found.id === id)!;

  it("reads a fever back in the degrees the parent typed", () => {
    const fever = card("fever-for-age", { latestTemperatureC: fToC(100.8), latestTemperatureAt: "2026-08-22T17:30:00" });
    expect(fever.body).toBe("You logged 100.8 °F. AAP's call-the-doctor threshold changes with age and is 100.4 °F for yours.");
    expect(fever.advice).toContain("NHS lists 100.4 °F or more");
    expect(`${fever.body} ${fever.advice}`).not.toContain("°C");
  });

  it("reads a low temperature back in Fahrenheit too", () => {
    const low = card("low-temperature-newborn", { ageDays: 20, latestTemperatureC: 35.6, latestTemperatureAt: "2026-08-22T17:30:00" });
    expect(low.body).toBe("You logged 96.1 °F. NHS lists a temperature below 96.8 °F — or a baby who feels cold to the touch or is shivery — under “Call 999 or go to A&E”.");
  });

  it("keeps the metric wording as it was", () => {
    const fever = card("fever-for-age", { units: "metric", latestTemperatureC: 38.2, latestTemperatureAt: "2026-08-22T17:30:00" });
    expect(fever.body).toBe("You logged 38.2 °C. AAP's call-the-doctor threshold changes with age and is 38.0 °C for yours.");
    expect(fever.advice).toContain("NHS lists 38 °C or more");
  });

  it("tells two close weights apart in pounds", () => {
    const under = card("under-birthweight-at-three-weeks", {
      ageDays: 25,
      weights: [weight("a", "2026-08-01T08:00:00", 3400), weight("b", "2026-08-21T08:00:00", 3390)],
    });
    expect(under.body).toContain("You logged 7.50 lb first and 7.47 lb most recently.");
  });

  it("gives weekly gains in ounces", () => {
    const slow = card("weekly-gain-low", {
      weights: [weight("a", "2026-08-08T08:00:00", 3400), weight("b", "2026-08-22T08:00:00", 3480)],
    });
    expect(slow.body).toMatch(/^About 1.4 oz a week between your last two weights, 14 days apart\./);

    const steady = card("growth-steady", {
      weights: [weight("a", "2026-08-01T08:00:00", 4000), weight("b", "2026-08-15T08:00:00", 4400)],
    });
    expect(steady.body).toBe("About 7.1 oz a week between your last two weights. The typical band at this age is 5.6 oz–7.4 oz a week.");
  });
});
