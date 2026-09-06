import { describe, expect, it } from "vitest";
import { languageNudge } from "@/domain/languageNudge";

// English is every phone's default, so the only way a Greek family learns
// the app speaks Greek is this banner. These pin down who sees it.

const greekPhoneInEnglish = { phoneSpeaksGreek: true, inEnglish: true, dismissed: false };

describe("languageNudge", () => {
  it("offers Greek to a Greek phone still reading English", () => {
    expect(languageNudge(greekPhoneInEnglish)).toBe(true);
  });

  it("never shows a Greek sentence to a phone that does not report Greek", () => {
    expect(languageNudge({ ...greekPhoneInEnglish, phoneSpeaksGreek: false })).toBe(false);
  });

  it("has nothing to say once the app is already in Greek", () => {
    expect(languageNudge({ ...greekPhoneInEnglish, inEnglish: false })).toBe(false);
  });

  it("takes no for an answer, permanently", () => {
    expect(languageNudge({ ...greekPhoneInEnglish, dismissed: true })).toBe(false);
  });
});
