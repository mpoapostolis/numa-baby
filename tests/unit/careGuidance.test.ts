import { describe, expect, it } from "vitest";
import { CARE_BRACKETS, WATCH_FOR, careForAge } from "@/domain/careGuidance";

// The contract that makes daily guidance trustworthy: every age maps to
// exactly one bracket, every card names an action and a real source, and the
// call-someone list never depends on anything the app itself computed.

describe("CARE_BRACKETS", () => {
  it("covers every age from day 0 onward with no gaps or overlaps", () => {
    expect(CARE_BRACKETS[0].fromDay).toBe(0);
    for (let i = 1; i < CARE_BRACKETS.length; i++) {
      expect(CARE_BRACKETS[i].fromDay).toBe(CARE_BRACKETS[i - 1].toDay + 1);
    }
    expect(CARE_BRACKETS.at(-1)?.toDay).toBe(Infinity);
  });

  it("every card states what to expect, what to do, and where it came from", () => {
    for (const bracket of CARE_BRACKETS) {
      expect(bracket.stage.length).toBeGreaterThan(3);
      expect(bracket.cards.length).toBeGreaterThanOrEqual(3);
      for (const card of bracket.cards) {
        expect(card.title.length).toBeGreaterThan(10);
        expect(card.body.length).toBeGreaterThan(20);
        expect(card.action.length).toBeGreaterThan(15);
        expect(card.source.name.length).toBeGreaterThan(3);
        expect(card.source.url).toMatch(/^https:\/\/(www\.)?(healthychildren|nhs|who)\./);
      }
    }
  });

  it("gives each bracket more than one kind of card", () => {
    for (const bracket of CARE_BRACKETS) {
      expect(new Set(bracket.cards.map((card) => card.kind)).size).toBeGreaterThan(1);
    }
  });
});

describe("careForAge", () => {
  it("returns null for unusable ages", () => {
    expect(careForAge(-1)).toBeNull();
    expect(careForAge(Number.NaN)).toBeNull();
    expect(careForAge(Infinity)).toBeNull();
  });

  it("puts a newborn in the first-days bracket and a toddler in the last", () => {
    expect(careForAge(0)).toBe(CARE_BRACKETS[0]);
    expect(careForAge(3)).toBe(CARE_BRACKETS[0]);
    expect(careForAge(10_000)).toBe(CARE_BRACKETS.at(-1));
  });

  it("does not tell a two-day-old's parent to expect six wet nappies", () => {
    // The day 1-2 count really is low; promising six would read as a failure.
    const early = careForAge(1);
    const later = careForAge(7);
    expect(early?.cards.some((c) => c.title.includes("2 or 3 wet nappies"))).toBe(true);
    expect(later?.cards.some((c) => c.title.includes("6 or more heavy wet nappies"))).toBe(true);
  });

  it("floors a fractional age to the day", () => {
    expect(careForAge(4.9)).toBe(careForAge(4));
  });
});

describe("WATCH_FOR", () => {
  it("names a source for every sign", () => {
    expect(WATCH_FOR.length).toBeGreaterThanOrEqual(4);
    for (const item of WATCH_FOR) {
      expect(item.sign.length).toBeGreaterThan(30);
      expect(item.source.url).toMatch(/^https:\/\//);
    }
  });

  it("keeps the under-three-months fever threshold exact", () => {
    const fever = WATCH_FOR.find((item) => item.sign.includes("38.0"));
    expect(fever).toBeDefined();
    expect(fever?.sign).toContain("rectal");
    expect(fever?.sign).toContain("3 months");
  });
});
