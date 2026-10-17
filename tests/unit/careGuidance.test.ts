import { describe, expect, it } from "vitest";
import { CARE_BRACKETS, WATCH_FOR, WATCH_TIERS, careForAge } from "@/domain/careGuidance";

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
        for (const source of [card.source, card.alsoSource ?? card.source]) {
          expect(source.name.length).toBeGreaterThan(3);
          expect(source.url).toMatch(/^https:\/\/(www\.)?(healthychildren|nhs|who)\./);
        }
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

  it("does not tell a two-day-old's parent to expect six wet diapers", () => {
    // The day 1-2 count really is low; promising six would read as a failure.
    const early = careForAge(1);
    const later = careForAge(7);
    expect(early?.cards.some((c) => c.title.includes("2 or 3 wet diapers"))).toBe(true);
    expect(later?.cards.some((c) => c.title.includes("6 or more heavy wet diapers"))).toBe(true);
  });

  it("never announces first foods as starting 'now' to a baby past the start", () => {
    // The 6-12 month bracket is read by a ten-month-old's parent too.
    for (const bracket of CARE_BRACKETS) {
      for (const card of bracket.cards) expect(card.title).not.toMatch(/start now/i);
    }
  });

  it("floors a fractional age to the day", () => {
    expect(careForAge(4.9)).toBe(careForAge(4));
  });
});

describe("WATCH_FOR", () => {
  it("names a source and a tier for every sign", () => {
    expect(WATCH_FOR.length).toBeGreaterThanOrEqual(4);
    for (const item of WATCH_FOR) {
      // Short is allowed — "is having a seizure (fit)." is the NHS's whole
      // line — but each sign finishes "…if your baby", so it reads on from
      // the heading in lower case and ends a sentence.
      expect(item.sign.length).toBeGreaterThan(20);
      expect(item.sign).toMatch(/^[a-z].*\.$/);
      expect(item.source.url).toMatch(/^https:\/\//);
      expect(WATCH_TIERS.map((t) => t.tier)).toContain(item.tier);
    }
    for (const { tier } of WATCH_TIERS) {
      expect(WATCH_FOR.some((item) => item.tier === tier)).toBe(true);
    }
  });

  it("keeps the under-three-months fever threshold exact, and at the emergency number", () => {
    const fever = WATCH_FOR.find((item) => item.sign.includes("38.0"));
    expect(fever).toBeDefined();
    expect(fever?.sign).toContain("rectal");
    expect(fever?.sign).toContain("3 months");
    // The AAP says "call your pediatrician immediately" and the NHS lists it
    // under "Call 999 or go to A&E". "The same day" was the first bug; the
    // second was a line ending "call your doctor immediately", which kept
    // the emergency number from the parent whose own source says 999. So it
    // names no instruction of its own — the heading's number applies — and
    // cites the NHS page that says so beside the AAP's threshold.
    expect(fever?.tier).toBe("now");
    expect(fever?.sign).not.toMatch(/— (call|get)/);
    expect(fever?.alsoSource?.url).toContain("nhs.uk/baby/health/when-to-get-urgent-medical-help");
  });

  it("says only what the source says where the source names no emergency number", () => {
    // The NHS "signs of serious illness" need "urgent medical help" — the
    // page puts them under no 999 heading — and the AAP's dehydration signs
    // go to the doctor "immediately". Under the "now" heading, each of these
    // lines says its own instruction, so the emergency number is not claimed
    // for it; the heading's own line says that is how to read it.
    const now = WATCH_TIERS.find((t) => t.tier === "now");
    expect(now?.how).toContain("unless the line itself says what to do");
    for (const [fragment, instruction] of [
      ["floppy", "get urgent medical help"],
      ["8 hours", "get urgent medical help"],
      ["dehydration", "call your doctor immediately"],
    ]) {
      const item = WATCH_FOR.find((i) => i.sign.includes(fragment));
      expect(item?.sign, fragment).toMatch(new RegExp(`— ${instruction}\\.$`));
    }
  });

  it("gives the day-5 wet-diaper floor the same urgency as the dehydration line", () => {
    // NHS: midwife or health visitor, no hurry named. AAP: fewer than six a
    // day is dehydration — "immediately". The Growth guide shows both, so
    // the card says "now" and links the page that says it.
    const card = careForAge(7)?.cards.find((c) => c.title.includes("6 or more heavy wet diapers"));
    expect(card?.action).toMatch(/\bnow\b/);
    expect(card?.action).not.toMatch(/\btoday\b|same day/i);
    expect(card?.alsoSource?.url).toContain("dehydration");
  });

  it("never files a sign below the urgency its source states", () => {
    for (const item of WATCH_FOR) expect(item.sign).not.toMatch(/same day/i);
    // Each of these is under an NHS "Call 999 or go to A&E" heading, or is
    // the AAP's "notify the pediatrician immediately".
    for (const fragment of ["difficult to wake", "difficulty breathing", "does not fade", "seizure", "green vomit", "less than 24 hours old", "dehydration", "floppy", "not feeding"]) {
      const item = WATCH_FOR.find((i) => i.sign.includes(fragment));
      expect(item, fragment).toBeDefined();
      expect(item?.tier, fragment).toBe("now");
    }
  });

  it("says where to call in the tier that needs it", () => {
    const now = WATCH_TIERS.find((t) => t.tier === "now");
    for (const number of ["911", "999", "112"]) expect(now?.how).toContain(number);
  });
});
