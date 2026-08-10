import { describe, expect, it } from "vitest";
import { FACT_BRACKETS, factOfTheDay } from "@/domain/babyFacts";

// The contract that makes the welcome fact trustworthy: every age maps to
// exactly one bracket, every fact carries a real source, and the daily pick
// is deterministic — the same day always shows the same fact.

describe("FACT_BRACKETS", () => {
  it("covers every age from day 0 onward with no gaps or overlaps", () => {
    expect(FACT_BRACKETS[0].fromDay).toBe(0);
    for (let i = 1; i < FACT_BRACKETS.length; i++) {
      expect(FACT_BRACKETS[i].fromDay).toBe(FACT_BRACKETS[i - 1].toDay + 1);
    }
    expect(FACT_BRACKETS.at(-1)?.toDay).toBe(Infinity);
  });

  it("every fact is a real sentence with an https source", () => {
    for (const bracket of FACT_BRACKETS) {
      expect(bracket.facts.length).toBeGreaterThan(1);
      for (const fact of bracket.facts) {
        expect(fact.text.length).toBeGreaterThan(30);
        expect(fact.source.name.length).toBeGreaterThan(3);
        expect(fact.source.url).toMatch(/^https:\/\/[a-z]/);
      }
    }
  });
});

describe("factOfTheDay", () => {
  it("returns null for unusable ages", () => {
    expect(factOfTheDay(-1)).toBeNull();
    expect(factOfTheDay(Number.NaN)).toBeNull();
    expect(factOfTheDay(Infinity)).toBeNull();
  });

  it("always picks from the bracket matching the age", () => {
    for (const bracket of FACT_BRACKETS) {
      const lastDay = Number.isFinite(bracket.toDay) ? bracket.toDay : bracket.fromDay + 400;
      for (const day of [bracket.fromDay, lastDay]) {
        expect(bracket.facts).toContain(factOfTheDay(day));
      }
    }
  });

  it("is deterministic for a day and rotates the next day", () => {
    expect(factOfTheDay(15)).toBe(factOfTheDay(15));
    // Every bracket holds at least two facts, so consecutive days differ.
    expect(factOfTheDay(16)).not.toBe(factOfTheDay(15));
  });

  it("fractional ages floor to the day", () => {
    expect(factOfTheDay(15.9)).toBe(factOfTheDay(15));
  });

  it("day 0 gets a newborn fact", () => {
    const fact = factOfTheDay(0);
    expect(fact).not.toBeNull();
    expect(FACT_BRACKETS[0].facts).toContain(fact);
  });
});
