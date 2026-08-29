import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NOTE_MAX_LENGTH,
  NUMERIC_FIELDS,
  NumericFieldName,
  numericFieldError,
} from "@/domain/activitySchema";
import { activityUpdatedAt, isValidActivity, liveActivities, parseStoredData, validateDraft } from "@/domain/validate";
import { Activity } from "@/domain/types";

const profile = { name: "Mia", birthDate: "2026-07-14", feedingMode: "mixed" };

const baseActivity = { id: "a-1", type: "bottle", startedAt: "2026-08-01T10:00:00" };

function storedBlob(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ profile, activities: [], onboardingComplete: true, ...overrides });
}

const numericFieldNames = Object.keys(NUMERIC_FIELDS) as NumericFieldName[];

describe("isValidActivity numeric bounds", () => {
  // Table-driven straight from the schema: the storage guard must accept the
  // full advertised range and nothing beyond it.
  it.each(numericFieldNames)("%s accepts its stored range and rejects outside it", (name) => {
    const field = NUMERIC_FIELDS[name];
    const min = field.storedMin ?? field.min;
    expect(isValidActivity({ ...baseActivity, [name]: min })).toBe(true);
    expect(isValidActivity({ ...baseActivity, [name]: field.max })).toBe(true);
    expect(isValidActivity({ ...baseActivity, [name]: min - field.step })).toBe(false);
    expect(isValidActivity({ ...baseActivity, [name]: field.max + field.step })).toBe(false);
    expect(isValidActivity({ ...baseActivity, [name]: String(field.max) })).toBe(false);
  });

  it("caps notes at the shared maximum length", () => {
    expect(isValidActivity({ ...baseActivity, note: "x".repeat(NOTE_MAX_LENGTH) })).toBe(true);
    expect(isValidActivity({ ...baseActivity, note: "x".repeat(NOTE_MAX_LENGTH + 1) })).toBe(false);
  });

  it("tolerates the sync fields and rejects malformed ones", () => {
    expect(isValidActivity(baseActivity)).toBe(true);
    expect(isValidActivity({ ...baseActivity, updatedAt: "2026-08-02T10:00:00" })).toBe(true);
    expect(isValidActivity({ ...baseActivity, updatedAt: "not-a-date" })).toBe(false);
    expect(isValidActivity({ ...baseActivity, updatedAt: 1234 })).toBe(false);
    expect(isValidActivity({ ...baseActivity, deleted: true })).toBe(true);
    expect(isValidActivity({ ...baseActivity, deleted: false })).toBe(false);
    expect(isValidActivity({ ...baseActivity, deleted: "true" })).toBe(false);
  });
});

describe("sync helpers", () => {
  it("parseStoredData keeps tombstones in the parsed list", () => {
    const parsed = parseStoredData(storedBlob({
      activities: [baseActivity, { ...baseActivity, id: "a-2", deleted: true, updatedAt: "2026-08-02T10:00:00" }],
    }));
    expect(parsed.activities.map((activity) => activity.id)).toEqual(["a-1", "a-2"]);
    expect(parsed.droppedActivities).toBe(0);
  });

  it("liveActivities filters tombstones out", () => {
    const live: Activity = { id: "live", type: "bottle", startedAt: "2026-08-01T10:00:00" };
    const dead: Activity = { id: "dead", type: "bottle", startedAt: "2026-08-01T10:00:00", deleted: true };
    expect(liveActivities([live, dead])).toEqual([live]);
  });

  it("activityUpdatedAt falls back to startedAt for legacy rows", () => {
    expect(activityUpdatedAt({ id: "a", type: "diaper", startedAt: "2026-08-01T10:00:00" })).toBe("2026-08-01T10:00:00");
    expect(activityUpdatedAt({ id: "a", type: "diaper", startedAt: "2026-08-01T10:00:00", updatedAt: "2026-08-03T09:00:00" })).toBe("2026-08-03T09:00:00");
  });
});

describe("parseStoredData", () => {
  it("filters corrupt rows and reports how many were dropped", () => {
    const good = { ...baseActivity };
    const alsoGood = { id: "a-2", type: "sleep", startedAt: "2026-08-01T12:00:00", endedAt: "2026-08-01T13:00:00" };
    const parsed = parseStoredData(storedBlob({
      activities: [good, { junk: true }, alsoGood, "not-a-row", { ...baseActivity, id: "a-3", amount: 5_000 }],
    }));
    expect(parsed.activities.map((activity) => activity.id)).toEqual(["a-1", "a-2"]);
    expect(parsed.droppedActivities).toBe(3);
  });

  it("keeps droppedActivities at zero for a clean blob", () => {
    expect(parseStoredData(storedBlob({ activities: [baseActivity] })).droppedActivities).toBe(0);
  });

  it("throws only when the blob shape itself is wrong", () => {
    expect(() => parseStoredData(storedBlob({ profile: undefined }))).toThrow("Invalid Baby Tracker backup");
    expect(() => parseStoredData(storedBlob({ activities: "nope" }))).toThrow("Invalid Baby Tracker backup");
    expect(() => parseStoredData(JSON.stringify([]))).toThrow("Invalid Baby Tracker backup");
    expect(() => parseStoredData(JSON.stringify(null))).toThrow("Invalid Baby Tracker backup");
  });

  it("rejects an activities array above the 25,000 cap", () => {
    const activities = Array.from({ length: 25_001 }, (_, index) => ({
      ...baseActivity,
      id: `a-${index}`,
    }));
    expect(() => parseStoredData(storedBlob({ activities }))).toThrow("Invalid Baby Tracker activities");
  });

  it("detects legacy demo blobs and derives onboarding from isDemo", () => {
    expect(parseStoredData(storedBlob({ profile: { ...profile, isDemo: true } })).legacyDemo).toBe(true);
    expect(parseStoredData(storedBlob()).legacyDemo).toBe(false);
    const explicitReal = parseStoredData(JSON.stringify({ profile: { ...profile, isDemo: false }, activities: [] }));
    expect(explicitReal.onboardingComplete).toBe(true);
    const noFlags = parseStoredData(JSON.stringify({ profile, activities: [] }));
    expect(noFlags.onboardingComplete).toBe(false);
  });

  it("tolerates invalid nightMode and reminders instead of throwing", () => {
    const parsed = parseStoredData(storedBlob({
      nightMode: "yes",
      reminders: { feedEnabled: true, feedIntervalMinutes: 90 },
    }));
    expect(parsed.nightMode).toBeUndefined();
    expect(parsed.reminders).toBeUndefined();

    const valid = parseStoredData(storedBlob({
      nightMode: true,
      reminders: { feedEnabled: true, feedIntervalMinutes: 180 },
    }));
    expect(valid.nightMode).toBe(true);
    expect(valid.reminders).toEqual({ feedEnabled: true, feedIntervalMinutes: 180 });
  });
});

describe("validateDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const start = "2026-08-07T10:00";

  function draftFor(name: NumericFieldName, value: number) {
    if (name === "amount") {
      return validateDraft({ type: "bottle", start, amount: value, note: "" });
    }
    if (name === "temperatureC") {
      return validateDraft({ type: "health", start, temperatureC: String(value), note: "" });
    }
    return validateDraft({
      type: "growth",
      start,
      weightGrams: name === "weightGrams" ? String(value) : "3500",
      lengthCm: name === "lengthCm" ? String(value) : "",
      headCm: name === "headCm" ? String(value) : "",
      note: "",
    });
  }

  it.each(numericFieldNames)("%s enforces the schema bounds with the schema's copy", (name) => {
    const field = NUMERIC_FIELDS[name];
    expect(draftFor(name, field.min).ok).toBe(true);
    expect(draftFor(name, field.max).ok).toBe(true);
    expect(draftFor(name, field.min - field.step)).toEqual({ ok: false, message: numericFieldError(name), field: name });
    expect(draftFor(name, field.max + field.step)).toEqual({ ok: false, message: numericFieldError(name), field: name });
  });

  it("keeps the historical error copy byte for byte", () => {
    expect(numericFieldError("amount")).toBe("Enter a bottle amount between 1 and 1,000 ml.");
    expect(numericFieldError("weightGrams")).toBe("Enter a weight between 500 and 30,000 grams.");
    expect(numericFieldError("lengthCm")).toBe("Enter a length between 20 and 130 centimetres.");
    expect(numericFieldError("headCm")).toBe("Enter a head measurement between 20 and 80 centimetres.");
    expect(numericFieldError("temperatureC")).toBe("Enter a temperature between 30 and 45 °C.");
  });

  it("rejects an invalid or future start unless the path clamps", () => {
    expect(validateDraft({ type: "diaper", start: "2026-08-07T13:00", note: "" }))
      .toEqual({ ok: false, message: "Choose a valid start time that is not in the future.", field: "start" });
    const clamped = validateDraft({ type: "diaper", start: "2026-08-07T13:00", note: "" }, { clampTime: true });
    expect(clamped.ok && clamped.value.startedAt).toBe(new Date().toISOString());
  });

  it("requires and validates an end time when asked to", () => {
    const message = "The end time must be after the start and not in the future.";
    expect(validateDraft({ type: "nursing", start, end: "", note: "" }, { requireEnd: true }))
      .toEqual({ ok: false, message, field: "end" });
    expect(validateDraft({ type: "nursing", start, end: start, note: "" }, { requireEnd: true }))
      .toEqual({ ok: false, message, field: "end" });
    const equalAllowed = validateDraft({ type: "nursing", start, end: start, note: "" }, { allowEqualEnd: true });
    expect(equalAllowed.ok).toBe(true);
  });

  it("clamps a wild bottle amount into bounds instead of failing", () => {
    const clamped = validateDraft({ type: "bottle", start, amount: 10_000, note: "" }, { clampAmount: true });
    expect(clamped.ok && clamped.value.amount).toBe(NUMERIC_FIELDS.amount.max);
    const fallback = validateDraft({ type: "bottle", start, amount: Number.NaN, note: "" }, { clampAmount: true });
    expect(fallback.ok && fallback.value.amount).toBe(90);
  });

  it("requires a temperature or a note on a health draft", () => {
    expect(validateDraft({ type: "health", start, temperatureC: "", note: "  " }))
      .toEqual({ ok: false, message: "Add a temperature or a note.", field: "temperatureC" });
    const noteOnly = validateDraft({ type: "health", start, temperatureC: "", note: "Slept well" });
    expect(noteOnly.ok && noteOnly.value.note).toBe("Slept well");
  });

  it("rounds saved measurements to their field's step", () => {
    const result = validateDraft({
      type: "growth",
      start,
      weightGrams: "3500.6",
      lengthCm: "51.55",
      headCm: "35.04",
      note: "",
    });
    expect(result.ok && result.value.weightGrams).toBe(3501);
    expect(result.ok && result.value.lengthCm).toBe(51.6);
    expect(result.ok && result.value.headCm).toBe(35);
  });
});

describe("a nursing session that used both sides", () => {
  it("is one entry, not two", () => {
    // The common case: start on the left, switch, stop. Logging that as two
    // sessions doubles the feed count and halves both durations.
    expect(isValidActivity({
      id: "n1",
      type: "nursing",
      startedAt: "2026-08-29T02:00:00.000Z",
      endedAt: "2026-08-29T02:24:00.000Z",
      side: "both",
    })).toBe(true);
  });

  it("still refuses a side that means nothing", () => {
    expect(isValidActivity({
      id: "n2",
      type: "nursing",
      startedAt: "2026-08-29T02:00:00.000Z",
      side: "middle",
    })).toBe(false);
  });
});

describe("a medicine dose", () => {
  it("records what was given and when", () => {
    expect(isValidActivity({
      id: "m1",
      type: "medicine",
      startedAt: "2026-08-29T08:00:00.000Z",
      medicine: "Vitamin D drops",
      dose: "one drop",
    })).toBe(true);
  });

  it("keeps the dose as free text, because this app must not do paediatric dosing", () => {
    // "half a sachet" is a real answer and no number can hold it.
    expect(isValidActivity({
      id: "m2",
      type: "medicine",
      startedAt: "2026-08-29T08:00:00.000Z",
      medicine: "Paracetamol",
      dose: "2.5 ml from the syringe on the box",
    })).toBe(true);
  });

  it("refuses a name or dose that is not a bounded string", () => {
    const base = { id: "m3", type: "medicine", startedAt: "2026-08-29T08:00:00.000Z" };
    expect(isValidActivity({ ...base, medicine: 42 })).toBe(false);
    expect(isValidActivity({ ...base, dose: "x".repeat(NOTE_MAX_LENGTH + 1) })).toBe(false);
  });
});
